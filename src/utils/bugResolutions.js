import { ref as dbRef, get, update } from 'firebase/database';
import { db, auth } from '../firebase';

// The other half of the bug-report loop, ported from Cinema Roll (Matt,
// 2026-09-21: "in cinemaroll we report back to the person who reported a
// bug when we fix it. I like that and want to add that into the rest of our
// apps"). When a report is resolved, `yarn resolve-bug-report <id>
// --understood "..." --fixed "..."` writes a plain-language notice to
// `bugReportResolutions/<reporterUid>/<reportId>`, and
// BugResolutionNotice.vue shows the unseen ones on the reporter's next
// launch.
//
// The node is keyed by the reporter's Firebase uid - the same uid the report
// carried as reporterUid - so the per-uid rule lets exactly that person read
// it. A signed-out reporter got a silent anonymous session when they filed
// (see bugReports.js); that session persists on the device, so the notice
// finds its way back to the same phone. The node is SHARED across every app
// on this Firebase project, so each notice names its `app` and each app
// shows only its own.
//
// "Seen" is prompt state, not user-authored content: a lost write means the
// notice shows twice, nothing worse.

const APP = 'deck-city';
const PATH = 'bugReportResolutions';

/** Entries worth showing here: this app's, not yet seen, oldest first. */
export function unseenResolutions (entries, app = APP) {
  return Object.entries(entries || {})
    .filter(([, value]) => value && !value.seen && (!value.app || value.app === app))
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => (a.resolvedAt || 0) - (b.resolvedAt || 0));
}

const currentUid = () => auth?.currentUser?.uid || null;

export async function fetchUnseenResolutions () {
  const uid = currentUid();
  if (!db || !uid) return [];
  try {
    const snapshot = await get(dbRef(db, `${PATH}/${uid}`));
    return unseenResolutions(snapshot.val());
  } catch {
    // Offline or refused - the notice simply waits for another launch.
    return [];
  }
}

export async function markResolutionsSeen (ids) {
  const uid = currentUid();
  if (!db || !uid || !ids?.length) return;
  // One atomic multi-path update, and only of the `seen` leaves - the text
  // stays as the record of what was fixed.
  const updates = {};
  ids.forEach((id) => { updates[`${PATH}/${uid}/${id}/seen`] = true; });
  try {
    await update(dbRef(db), updates);
  } catch {
    // Same shrug: they'll be marked on a later dismissal instead.
  }
}
