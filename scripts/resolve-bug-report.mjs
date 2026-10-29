// Marks a bug report resolved AND tells the reporter, in plain language,
// what was wrong and what changed. The notice lands at
// `bugReportResolutions/<reporterUid>/<reportId>`, where the app's
// BugResolutionNotice.vue shows it on the reporter's next launch. Pattern
// ported from Cinema Roll (Matt, 2026-09-21: "I like that and want to add
// that into the rest of our apps").
//
//   yarn resolve-bug-report <reportId> \
//     --understood "What was going wrong, in their terms" \
//     --fixed "What we did about it"
//
//   yarn resolve-bug-report <id> [id...] --silent   # resolve without a notice
//
// Write the two texts for a smart 12-year-old: no jargon, no file names, no
// component names. "The list forgot your filters when you came back" beats
// "route state wasn't persisted". The reporter sees exactly these words.
//
// --silent exists for reports that need no reply: duplicates, QA noise,
// reports filed by whoever is running this command. Resolving WITHOUT saying
// which - texts or --silent - is refused, so closing the loop is the default
// shape of resolving a bug, not an optional extra.
//
// Uses the Firebase Admin SDK, same as fetch-bug-reports - the report node is
// write-only from the browser, and the notice node is readable only by its
// reporter. Requires the same two env vars (read from .env.local via Node's
// native --env-file flag):
//   VUE_APP_FIREBASE_DATABASE_URL
//   FIREBASE_ADMIN_KEY_PATH

import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const APP = 'deck-city';
const REPORTS_PATH = 'deckCityBugReports';
const RESOLUTIONS_PATH = 'bugReportResolutions';

const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH;
const databaseURL = process.env.VUE_APP_FIREBASE_DATABASE_URL;

if (!keyPath || !databaseURL) {
  console.error('Missing FIREBASE_ADMIN_KEY_PATH and/or VUE_APP_FIREBASE_DATABASE_URL in .env.local.');
  process.exit(1);
}

function usage () {
  console.error('Usage: yarn resolve-bug-report <reportId> --understood "..." --fixed "..."');
  console.error('       yarn resolve-bug-report <reportId> [reportId...] --silent');
  console.error('');
  console.error('The --understood / --fixed texts are shown to the reporter in the app,');
  console.error('word for word - write them for a smart 12-year-old, no jargon.');
  console.error('--silent skips the notice (duplicates, QA noise, self-filed reports).');
  process.exit(1);
}

// Tiny argv parse: flags take the next token as their value; everything else
// is a report id.
const reportIds = [];
let understood = null;
let fixed = null;
let silent = false;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--understood') {
    understood = args[++i] ?? null;
  } else if (arg === '--fixed') {
    fixed = args[++i] ?? null;
  } else if (arg === '--silent') {
    silent = true;
  } else if (arg.startsWith('--')) {
    console.error(`Unknown flag ${arg}\n`);
    usage();
  } else {
    reportIds.push(arg);
  }
}

if (!reportIds.length) usage();

if (!silent && (!understood?.trim() || !fixed?.trim())) {
  console.error('Refusing to resolve without telling the reporter what happened.');
  console.error('Provide --understood and --fixed, or pass --silent to skip the notice.\n');
  usage();
}

if (!silent && reportIds.length > 1) {
  // One explanation cannot honestly describe several different reports.
  console.error('A notice describes ONE report - resolve them one at a time,');
  console.error('or pass --silent to close several without notices.');
  process.exit(1);
}

/** The reporter's own words, shortened enough to quote back in a panel. */
const snippetOf = (transcript, limit = 280) => {
  const text = (transcript || '').trim();
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
};

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount), databaseURL });
const db = getDatabase();

for (const id of reportIds) {
  const reportRef = db.ref(`${REPORTS_PATH}/${id}`);
  const snapshot = await reportRef.once('value');
  if (!snapshot.exists()) {
    console.error(`No report found with id ${id} - skipping.`);
    continue;
  }
  const report = snapshot.val();
  const resolvedAt = Date.now();

  const change = { resolved: true, resolvedAt };
  if (!silent) change.resolution = { understood, fixed };
  await reportRef.update(change);
  console.log(`Marked ${id} resolved.`);

  if (silent) continue;

  const uid = report.reporterUid;
  if (!uid) {
    console.warn(`  ! ${id} has no reporter uid - resolved, but there is nobody to notify.`);
    continue;
  }

  await db.ref(`${RESOLUTIONS_PATH}/${uid}/${id}`).set({
    app: APP,
    understood,
    fixed,
    reportSnippet: snippetOf(report.transcript),
    reportedAt: report.createdAt || null,
    resolvedAt,
    seen: false,
  });
  console.log(`  Notice queued for ${report.reporterDisplayName || uid} - they'll see it on their next launch.`);
}

process.exit(0);
