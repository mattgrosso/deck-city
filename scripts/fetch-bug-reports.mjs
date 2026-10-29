// Prints every UNRESOLVED bug report submitted via the in-game "Report a
// bug" button (src/components/shared/BugReportButton.vue ->
// src/utils/bugReports.js), newest first. Uses the Firebase Admin SDK,
// which bypasses database.rules.json's client-facing rules entirely
// (deckCityBugReports is write-only from the browser) - this is the read
// path. Reads "deckCityBugReports", NOT "bugReports" - this project's
// RTDB is shared with the thunderstone repo (see CLAUDE.md), and that key
// is thunderstone's own inbox.
// Once triaged, mark a report resolved with `yarn resolve-bug-report
// <reportId>` (scripts/resolve-bug-report.mjs) so it stops showing up here.
//
// Requires two env vars, both read from .env.local via Node's native
// --env-file flag (no dotenv dependency needed - see package.json's
// "fetch-bug-reports" script):
//   VUE_APP_FIREBASE_DATABASE_URL - already set for the app itself
//   FIREBASE_ADMIN_KEY_PATH       - path to a service-account JSON key
//                                    (Firebase Console -> Project Settings
//                                    -> Service Accounts -> Generate new
//                                    private key). Not committed to git.
//
// Run with: yarn fetch-bug-reports          (unresolved only)
//       or: yarn fetch-bug-reports --all    (everything, resolved or not)

import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH;
const databaseURL = process.env.VUE_APP_FIREBASE_DATABASE_URL;

if (!keyPath || !databaseURL) {
  console.error('Missing FIREBASE_ADMIN_KEY_PATH and/or VUE_APP_FIREBASE_DATABASE_URL in .env.local.');
  console.error('See the setup steps in the "In-game bug report tool" plan.');
  process.exit(1);
}

const showAll = process.argv.includes('--all');

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount), databaseURL });

const snapshot = await getDatabase().ref('deckCityBugReports').once('value');
const reports = snapshot.val() || {};
const allEntries = Object.entries(reports).sort(
  ([, a], [, b]) => (b.createdAt || 0) - (a.createdAt || 0),
);
const entries = showAll ? allEntries : allEntries.filter(([, report]) => !report.resolved);
const resolvedCount = allEntries.length - allEntries.filter(([, report]) => !report.resolved).length;

if (!allEntries.length) {
  console.log('No bug reports yet.');
  process.exit(0);
}
if (!entries.length) {
  console.log(`No unresolved bug reports (${resolvedCount} resolved - rerun with --all to see them).`);
  process.exit(0);
}

for (const [id, report] of entries) {
  const when = report.createdAt ? new Date(report.createdAt).toISOString() : 'unknown time';
  // gameState is written as a JSON string, not a raw object (see
  // src/utils/bugReports.js's own comment - RTDB silently drops empty-
  // object keys otherwise) - but a report submitted from a browser tab
  // that was still running the old client code (open before that fix
  // shipped, e.g. a tab left open across a deploy) wrote it as a raw
  // object instead, and JSON.parse on an object throws ("[object Object]"
  // is not valid JSON). Accept both shapes rather than assuming every
  // report in the (already-written, unchangeable) database matches the
  // current client version.
  const gs = typeof report.gameState === 'string' ? JSON.parse(report.gameState) : (report.gameState || null);
  // Field names are Deck City's (src/engine/state/createGameState.js):
  // turn.{stage,activeSeat}, pending[] (the prompt queue), players[].{pool,
  // tableau,hand}, meta.{phase,round,threshold,winnerSeat}, and log entries
  // keyed by SEAT (kinds place/claimPlace/monument/power/pass/lifeLoss/...).
  const seatName = (seat) => {
    const p = gs?.players?.[seat];
    return p ? `${p.name || p.id}${p.isBot ? ' (bot)' : ''}` : `seat ${seat}`;
  };
  const poolText = (pool) => Object.entries(pool || {}).filter(([, n]) => n).map(([e, n]) => `${n}${e[0].toUpperCase()}`).join(' ') || '-';
  const playersText = gs
    ? (gs.players || []).map((p) => `${p.name || p.id}: ${poolText(p.pool)}, ${(p.tableau || []).length} in play, ${(p.hand || []).length} in hand${p.passed ? ', passed' : ''}`).join('; ')
    : '';
  const waiting = gs?.pending?.[0] ? `${gs.pending[0].kind} for ${seatName(gs.pending[0].seat)}` : `active: ${seatName(gs?.turn?.activeSeat)}`;
  const gameSummary = gs
    ? `${gs.meta?.phase}, round ${gs.meta?.round}, ${gs.turn?.stage}, to ${gs.meta?.threshold}; ${waiting}; [${playersText}]`
      + (gs.meta?.phase === 'finished' ? `; winner ${seatName(gs.meta?.winnerSeat)}` : '')
    : '(no game state attached)';

  console.log('='.repeat(72));
  console.log(`report ${id} - ${when}${report.resolved ? ' [RESOLVED]' : ''}`);
  console.log(`reporter: ${report.reporterDisplayName || report.reporterUid || 'unknown'}`);
  console.log(`url: ${report.url || 'unknown'}`);
  console.log(`userAgent: ${report.userAgent || 'unknown'}`);
  console.log(`screenSize: ${report.screenSize || 'unknown'}${report.devicePixelRatio ? ` @${report.devicePixelRatio}x` : ''}`);
  console.log(`game: ${gameSummary}`);
  // Screen, open dialogs, my seat, room, connectivity, recent errors, build
  // (src/utils/bugContext.js) - written since 2026-10-10, never printed before.
  if (report.version) console.log(`version: ${report.version}${report.viewport ? ` · viewport ${report.viewport}` : ''}`);
  if (report.context) console.log(`context: ${JSON.stringify(report.context, null, 2)}`);
  console.log('---');
  console.log(report.transcript || '(empty)');
  // Matt: "the log should be part of what we send... so that you can see
  // what was done previous to the bug being reported." The log was already
  // being captured (it's just a field on the full gameState object, right
  // there in the dump below), but it was easy to miss entirely, buried
  // inside a huge players/instances/village JSON blob with no dedicated
  // summary - printed here readably, newest-last (chronological, matching
  // how a person reads a transcript), so "what happened right before this"
  // is visible at a glance instead of requiring a manual search.
  if (gs?.log?.length) {
    console.log(`--- recent log (${gs.log.length} entries) ---`);
    for (const entry of gs.log) {
      const who = seatName(entry.seat);
      const detail = {
        round: () => `-- round ${entry.round}, first player ${seatName(entry.firstPlayer)}`,
        place: () => `${who} placed ${entry.cardId}${entry.via ? ` via ${entry.via}` : ''}`,
        claimPlace: () => `${who} claimed ${entry.cardId}`,
        monument: () => `${who} bought ${entry.cardId}`,
        power: () => `${who} used ${entry.cardId} power ${entry.index}`,
        scroll: () => `${who} used the ${entry.scrollId} scroll`,
        discard: () => `${who} discarded ${entry.cardId} for essences`,
        pass: () => `${who} passed, taking ${entry.cardId}`,
        lifeLoss: () => `${who}'s ${entry.cardId}: ${entry.amount} life loss on seats ${(entry.targets || []).join(',')}`,
        lifeLost: () => `${who} lost ${entry.amount} life`,
        lifeIgnored: () => `${who} ignored a life loss (${entry.how})`,
        collect: () => `${who} collected`,
        finished: () => `game over, winner ${seatName(entry.winnerSeat)}`,
      }[entry.kind];
      console.log(`  ${detail ? detail() : `${entry.kind} ${who}`}`);
    }
  }
  if (gs) {
    console.log('--- full game state ---');
    console.log(JSON.stringify(gs, null, 2));
  }
}

console.log('='.repeat(72));
console.log(`${entries.length} report(s) shown${showAll ? '' : ` (${resolvedCount} resolved report(s) hidden - rerun with --all to see them)`}.`);

// Flush stdout before the hard exit. process.exit() tears the process down
// without draining async stream writes, and stdout to a PIPE is async (to a
// TTY it's synchronous) - so `yarn fetch-bug-reports | grep/awk/less` was
// silently truncated at the ~64KB pipe buffer while plain terminal runs
// looked complete. A zero-length write's callback only fires after every
// previously queued write has drained (stream writes are ordered), making
// this a reliable flush barrier. The hard exit itself stays: the Admin
// SDK's open RTDB connection otherwise keeps the event loop alive for
// minutes after the work is done.
await new Promise((resolve) => { process.stdout.write('', resolve); });
process.exit(0);
