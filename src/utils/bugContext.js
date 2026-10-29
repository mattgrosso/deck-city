// Everything that might even remotely help with a bug report, gathered into
// one compact object (Matt, 2026-10-10: "make sure that we are always passing
// in any information that might or even remotely could be relevant to any
// bug report"). The full game state still rides along as `gameState`; this is
// the at-a-glance read of it plus everything that ISN'T in the game state:
// which screen, which dialog, my seat, the room, connectivity, recent errors.
//
// Two rules hold throughout:
//   - Gathering can never block a report. Every section is guarded on its
//     own, so one bad field costs that field, not the report.
//   - Nothing secret and nobody else's email. Names and seats only - the
//     same names already printed on the table.

import { ref as dbRef, onValue } from 'firebase/database';
import { buildStamp } from './buildStamp';
import { queuedBugReportCount } from './bugReports';

const MAX_ERRORS = 8;
const MAX_TEXT = 300;
const loadedAt = Date.now();

const recentErrors = [];
let errorsInstalled = false;

const clip = (value, n = MAX_TEXT) => {
  const s = String(value ?? '');
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

export const recordError = (kind, message, extra = null) => {
  try {
    recentErrors.push({
      kind,
      message: clip(message),
      ...(extra ? { where: clip(extra, 160) } : {}),
      at: new Date().toISOString(),
    });
    while (recentErrors.length > MAX_ERRORS) recentErrors.shift();
  } catch {
    // Never let the recorder become the error.
  }
};

export const getRecentErrors = () => recentErrors.slice();
export const clearRecentErrors = () => { recentErrors.length = 0; };

/**
 * window.onerror, unhandledrejection and console.error (which is where Vue's
 * own render/watcher errors and the sync layer's give-ups land), kept in a
 * small ring. Once per page; console.error still prints exactly as before.
 */
export function installErrorCapture (target = window, con = console) {
  if (errorsInstalled || !target?.addEventListener) return;
  errorsInstalled = true;
  target.addEventListener('error', (e) => {
    const where = e?.filename ? `${e.filename}:${e.lineno || 0}:${e.colno || 0}` : null;
    recordError('error', e?.error?.message || e?.message || 'unknown error', where);
  });
  target.addEventListener('unhandledrejection', (e) => {
    const r = e?.reason;
    recordError('unhandledrejection', r?.message || r || 'unknown rejection');
  });
  if (con && typeof con.error === 'function') {
    const original = con.error;

    con.error = function captureConsoleError (...args) {
      try {
        recordError('console.error', args.map((a) => (a instanceof Error ? a.message
          : (typeof a === 'string' ? a : guard(() => JSON.stringify(a))))).join(' '));
      } catch {
        // fall through to the real console.error
      }
      return original.apply(this, args);
    };
  }
}

// Firebase's own view of the socket, distinct from navigator.onLine: a phone
// can be "online" with RTDB still disconnected, and that gap is exactly where
// sync bugs live.
const connection = { firebaseConnected: null, since: null, changes: 0 };
let connectionInstalled = false;

export function installConnectionWatch (db) {
  if (connectionInstalled || !db) return;
  connectionInstalled = true;
  try {
    onValue(dbRef(db, '.info/connected'), (snap) => {
      connection.firebaseConnected = Boolean(snap.val());
      connection.since = new Date().toISOString();
      connection.changes += 1;
    });
  } catch {
    // No watch, no field - the report still goes.
  }
}

export const getConnection = () => ({ ...connection });

function guard (fn) {
  try {
    return fn();
  } catch (e) {
    return { gatherError: clip(e?.message || e, 120) };
  }
}

// Mirrors App.vue's screen chain. `wantsOnline` is App-local, so "menu" may
// really be the online lobby before a room exists; the open-dialog list and
// URL fill that in.
export const screenOf = (state, getters) => {
  if (getters.isApproved === false && state.firebaseConfigured) return 'site-gate';
  if (getters.isFinished) return 'score-sheet';
  if (state.game) return 'table';
  if (state.roomId) return 'online-lobby';
  return 'menu';
};

const openDialogs = (doc = typeof document !== 'undefined' ? document : null) => {
  if (!doc?.querySelectorAll) return [];
  return [...doc.querySelectorAll('[role="dialog"]')]
    .map((el) => el.getAttribute('aria-label') || el.className || 'dialog')
    .filter((label) => label !== 'Report a bug');
};

const playerLine = (p) => (p ? {
  seat: p.seat, name: p.name, isBot: Boolean(p.isBot), passed: Boolean(p.passed),
  pool: p.pool, hand: p.hand?.length ?? 0, deck: p.deck?.length ?? 0, discard: p.discard?.length ?? 0,
  mage: p.mage?.cardId ?? null, item: p.item?.cardId ?? null,
  tableau: (p.tableau || []).map((c) => `${c.cardId}${c.turned ? '(t)' : ''}`),
} : null);

export const gameSummary = (game, getters = {}, state = {}) => {
  if (!game) return null;
  const players = game.players || [];
  const waitingSeat = game.pending?.[0]?.seat ?? game.turn?.activeSeat;
  const active = players[waitingSeat];
  const me = getters.me || null;
  const lastLog = (game.log || []).slice(-3).map((entry) => clip(JSON.stringify(entry), 200));
  return {
    phase: game.meta?.phase ?? null,
    seq: game.meta?.seq ?? null,
    round: game.meta?.round ?? null,
    stage: game.turn?.stage ?? null,
    sets: game.meta?.sets ?? null,
    threshold: game.meta?.threshold ?? null,
    firstPlayer: game.firstPlayer ?? null,
    activeSeat: game.turn?.activeSeat ?? null,
    waitingSeat: waitingSeat ?? null,
    pending: game.pending?.[0] ? clip(JSON.stringify(game.pending[0]), 200) : null,
    pendingCount: game.pending?.length ?? 0,
    activePlayer: active ? { name: active.name, isBot: Boolean(active.isBot) } : null,
    thinkingPlayerId: state.thinkingPlayerId || null,
    playerCount: players.length,
    botCount: players.filter((p) => p.isBot).length,
    mySeat: getters.mySeat ?? (me ? me.seat : -1),
    myName: me?.name ?? null,
    myTurn: Boolean(getters.myTurn),
    players: players.map(playerLine),
    places: (game.center?.places || []).map((c) => c.cardId),
    monuments: game.center?.monumentDisplay || [],
    monumentDeck: game.center?.monumentDeck?.length ?? 0,
    items: (game.center?.items || []).map((c) => c.cardId),
    scrolls: game.center?.scrolls || [],
    winnerSeat: game.meta?.winnerSeat ?? null,
    logLength: (game.log || []).length,
    lastLog,
  };
};

export const roomSummary = (state, getters = {}) => {
  if (!state.roomId) return null;
  const meta = state.roomMeta || {};
  const presence = state.presence || {};
  return {
    roomId: state.roomId,
    roomCode: meta.roomCode || null,
    status: meta.status || null,
    tableSize: meta.tableSize ?? null,
    async: Boolean(meta.async),
    isHost: Boolean(getters.isHost),
    humanSlots: (meta.playerSlots || []).length,
    presentCount: Object.values(presence).filter(Boolean).length,
    absentPlayers: (getters.absentPlayerIds || []).length,
    roomError: state.roomError ? clip(state.roomError?.message || state.roomError, 200) : null,
  };
};

const environment = () => {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const win = typeof window !== 'undefined' ? window : {};
  return {
    navigatorOnline: typeof nav.onLine === 'boolean' ? nav.onLine : null,
    ...getConnection(),
    visibility: typeof document !== 'undefined' ? document.visibilityState : null,
    standalone: Boolean(win.matchMedia?.('(display-mode: standalone)')?.matches || nav.standalone),
    serviceWorkerControlled: Boolean(nav.serviceWorker?.controller),
    language: nav.language || null,
    timeZone: guard(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
    reducedMotion: Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches),
    orientation: win.screen?.orientation?.type || null,
    secondsSinceLoad: Math.round((Date.now() - loadedAt) / 1000),
  };
};

/**
 * The bug report's `context`. Takes the store (state + getters); anything
 * that throws is replaced by { gatherError } for that section only.
 */
export function buildBugContext (store, extra = {}) {
  const state = store?.state || {};
  const getters = store?.getters || {};
  const out = {
    // The original three keys, kept so older triage scripts still read them.
    online: Boolean(state.roomId),
    roomCode: state.roomMeta?.roomCode || null,
    uid: state.user?.uid || null,
  };
  out.screen = guard(() => screenOf(state, getters));
  out.openDialogs = guard(() => openDialogs());
  out.build = guard(() => buildStamp() || null);
  out.auth = guard(() => ({
    signedIn: Boolean(state.user),
    anonymous: Boolean(state.user?.isAnonymous),
    authReady: Boolean(state.authReady),
    siteUserReady: Boolean(state.siteUserReady),
    siteStatus: state.siteUser?.status || null,
    isAdmin: Boolean(getters.isAdmin),
    firebaseConfigured: Boolean(state.firebaseConfigured),
  }));
  out.settings = guard(() => ({
    opponents: state.settings?.opponents ?? null,
    hasSavedGame: Boolean(state.hasSavedGame),
  }));
  out.game = guard(() => gameSummary(state.game, getters, state));
  out.room = guard(() => roomSummary(state, getters));
  out.environment = guard(() => environment());
  out.recentErrors = guard(() => getRecentErrors());
  out.queuedReports = guard(() => queuedBugReportCount());
  Object.assign(out, extra);
  return out;
}
