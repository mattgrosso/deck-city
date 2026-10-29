import { ref as dbRef, push, set } from 'firebase/database';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '../firebase';

// In-game bug reports, ported from the thunderstone and space-base repos:
// capture what the player typed plus a full snapshot of the game state, write
// it to RTDB, read it back with `yarn fetch-bug-reports`.
//
// Matt, on the sibling apps: "We should allow bug reports even when we're
// offline in this app and then when you get back online, the next time they
// should all get reported." The RTDB client can queue writes made while
// offline, but only in memory for the current page load - a reload while
// still offline loses them. Writing the report to localStorage BEFORE
// attempting the real write, and only clearing it once that write actually
// lands, survives both.
//
// This matters more here than in either sibling: Deck City is an offline-
// capable PWA whose whole point is that it works on a plane.

const QUEUE_KEY = 'deckCity:queuedBugReports';
const PATH = 'deckCityBugReports';

function readQueue () {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    // A corrupted queue must never block a NEW report from being submitted.
    return [];
  }
}

function writeQueue (queue) {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Full or disabled storage: the in-memory attempt below still happens.
  }
}

/**
 * A report carries the state as a JSON STRING for the same reason the room
 * sync does - RTDB drops empty arrays (in No Thanks!, for one, a player who
 * has taken no cards is exactly `cards: []`), and a snapshot that quietly
 * loses an empty list would be actively misleading in a bug report.
 */
// reporter / url / screenSize / devicePixelRatio are the fields
// fetch-bug-reports prints; until 2026-09-11 none of them were written, so
// every report read "reporter: unknown" (found via telestrations).
const buildReport = ({
  transcript, gameState, context, reporter,
}) => ({
  transcript: String(transcript || '').slice(0, 5000),
  gameState: gameState ? JSON.stringify(gameState) : null,
  context: context || null,
  reporterUid: reporter?.uid || null,
  reporterDisplayName: reporter?.displayName || null,
  url: window.location.href,
  screenSize: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
  devicePixelRatio: window.devicePixelRatio || 1,
  version: process.env.VUE_APP_GIT_SHA || 'unknown',
  userAgent: navigator.userAgent,
  viewport: `${window.innerWidth}x${window.innerHeight}`,
  createdAt: new Date().toISOString(),
  resolved: false,
});

async function writeReport (report) {
  if (!db) throw new Error('Bug reports need Firebase configured (see .env.example).');
  // The inbox requires auth != null (2026-08-29 - Firebase's scanner emails
  // daily about authless writes, and Matt chose real auth over muting). A
  // signed-out reporter gets a SILENT anonymous session minted right here;
  // the store's initAuth deliberately ignores anonymous users, so this never
  // signs anyone "in".
  if (auth && !auth.currentUser) await signInAnonymously(auth);
  const reportRef = push(dbRef(db, PATH));
  await set(reportRef, report);
  return reportRef.key;
}

/**
 * Queues the report locally, then tries to send it. Resolves either way - a
 * report that couldn't be sent is not lost, it is waiting.
 * Returns { sent: boolean }.
 */
export async function submitBugReport ({
  transcript, gameState, context, reporter,
}) {
  const report = buildReport({
    transcript, gameState, context, reporter,
  });
  const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const queue = readQueue();
  queue.push({ localId, report });
  writeQueue(queue);

  try {
    await writeReport(report);
    writeQueue(readQueue().filter((entry) => entry.localId !== localId));
    return { sent: true };
  } catch {
    // Left in the queue on purpose; flushQueuedBugReports retries at startup.
    return { sent: false };
  }
}

/**
 * Replays anything still queued from a previous session. Called once at
 * startup (main.js). Silent by design: a player who reported a bug on a
 * plane should not be told about it again on the ground.
 */
export async function flushQueuedBugReports () {
  const queue = readQueue();
  if (queue.length === 0 || !db) return;

  const stillPending = [];
  for (const entry of queue) {
    try {
      // failure means we're offline, and the rest will fail the same way.
      await writeReport(entry.report);
    } catch {
      stillPending.push(entry);
    }
  }
  writeQueue(stillPending);
}

export const queuedBugReportCount = () => readQueue().length;
