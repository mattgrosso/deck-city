// Shared machinery for deciding WHEN a detected update may be applied, and
// for applying it safely. checkForUpdate.js owns the detection and the
// triggers; this file owns "is right now a moment we're allowed to yank the
// page out from under the player."
//
// Matt: "All of our apps need the new version auto reload feature we have in
// Cinemaroll." Ported from that repo's src/utils/appUpdate.js, with the
// unsafe-moment rules rewritten for this app - Cinema Roll's version only
// had to avoid interrupting a form or a mini-game round, whereas here the
// WHOLE app is a game with real sessions people care about.

// Waits until no service worker install is in flight, so a reload lands on
// the NEW app instead of a mixed old/new state. This app DOES register a
// worker (main.js, production builds only - workbox GenerateSW via
// vue.config.js, skipWaiting + clientsClaim), so this is a real wait here,
// not a formality. Capped; failures never block the reload.
export async function waitForNewWorker (timeoutMs = 15000) {
  try {
    const registration = await navigator.serviceWorker?.getRegistration?.();
    if (!registration) return;
    await registration.update().catch(() => {});
    const deadline = Date.now() + timeoutMs;
    while ((registration.installing || registration.waiting) && Date.now() < deadline) {
      await new Promise((resolve) => { setTimeout(resolve, 250); });
    }
  } catch {
    // Any surprise here must never eat the reload itself.
  }
}

export async function reloadForUpdate () {
  await waitForNewWorker();
  window.location.reload();
}

// Kept from the space-base version of this module, where createWebHashHistory
// (router/index.js) makes every route a `#/...` fragment readable straight off
// the URL. This app has no router - one screen, switched by store state, and
// isSafeMomentForReload takes `atTable` from its caller instead - so nothing
// here calls this; it stays so every copy exports the same surface (and this
// module stays free of Vue/Vuex so it can be unit-tested as plain functions).
export function currentRoutePath (href = window.location.href) {
  const hashIndex = href.indexOf('#');
  if (hashIndex === -1) return '/';
  const hash = href.slice(hashIndex + 1);
  const path = hash.split('?')[0];
  return path.startsWith('/') ? path : `/${path}`;
}

// A Deck City game is finished when a victory check finds the threshold:
// the engine sets meta.phase (engine/rules/victory.js) and nothing after
// that is live play - the score sheet reveals a result already computed.
export function isGameFinished (gameState) {
  // Deck City: the engine's playerState carries gameStatus ('playing' | 'won' | 'lost').
  return Boolean(gameState) && gameState.gameStatus !== 'playing';
}

// Anything on screen that means the player is mid-something. There's no
// body-level scroll lock in this app (Cinema Roll's `no-scroll` hook has no
// equivalent here) - every overlay is a Teleport-to-body element, so the
// presence of its own root class is the signal.
const BLOCKING_OVERLAY_SELECTORS = [
  '.bug-backdrop', // the bug-report form, mid-typing or mid-send
  '.bug-resolution-backdrop', // reading what happened to a bug they reported
  '.glossary-popup-backdrop', // a glossary explanation is open
  '.glossary-banner', // glossary mode is ON - taps mean something different
  '.card-magnify', // TapMagnifyOverlay - reading a blown-up card
  '.install-backdrop', // the iOS "Add to Home Screen" instructions
  '.tutorial-callout', // TutorialOverlay (belt-and-braces with tutorialActive)
  '.sheet-backdrop', // a card sheet, a prompt, the pass or pearl sheet - mid-decision
  '.card-face__magnify', // reading a blown-up card (TapMagnifyOverlay)
  '.approval-backdrop', // an admin is part-way through approving people
  '.howto-backdrop', // somebody is mid-way through learning the rules
];

/**
 * Is RIGHT NOW a safe moment to reload out from under the player?
 * Pure-ish and fully injectable so the rules can be unit-tested directly.
 *
 * What survives a reload here, and what doesn't - this is what the rules
 * below are built on:
 *  - A LOCAL game is written to localStorage on every setGame commit
 *    (store/index.js, SAVE_KEY) and App.vue resumes it on the next boot,
 *    bots re-armed - so the game itself comes back.
 *  - A REMOTE game lives in Firebase; nothing about the room is kept on
 *    this device, so a reload gets back to the table only by way of the
 *    room code or the ?join= link you arrived on.
 *  - Everything in flight is simply gone: a bot's turn timer, the pacing
 *    and reveals between moves, and every half-made choice living in a
 *    component's own data. What comes back is the state, not the moment.
 *
 * So: being AT THE TABLE with a live game is never a safe moment, even
 * after the 25s quiet stretch. Twenty-five seconds of no input is what
 * thinking about your move looks like, and it's also exactly what a slow
 * bot turn looks like. Sitting on the menu IS safe - a saved game is on
 * disk there, not in play, so it survives fine (and treating it as unsafe
 * would mean anyone with an unfinished game never got an update again).
 */
export function isSafeMomentForReload ({
  activeElement = typeof document === 'undefined' ? null : document.activeElement,
  root = typeof document === 'undefined' ? null : document,
  gameState = null,
  atTable = false,
} = {}) {
  const tag = activeElement?.tagName || '';
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return false;
  if (activeElement?.isContentEditable) return false;

  if (root && BLOCKING_OVERLAY_SELECTORS.some((selector) => root.querySelector(selector))) return false;

  // At the table with a game that isn't over yet: never. This app has no
  // router (one screen, switched by store state), so the caller passes the
  // fact directly instead of it being read back out of a hash route.
  if (atTable && gameState && !isGameFinished(gameState)) return false;

  return true;
}

// One auto-attempt per detected target bundle, ever - if the reload doesn't
// actually get us onto the new version (stuck worker, cache oddity), we stop
// rather than reloading in a loop. The manual reload button on the board's
// version tag remains the fallback.
const ATTEMPT_KEY = 'deck-city:auto-update-attempted-for';

export function shouldAutoAttempt (targetBundle, storage = window.sessionStorage) {
  try {
    if (storage.getItem(ATTEMPT_KEY) === targetBundle) return false;
    storage.setItem(ATTEMPT_KEY, targetBundle);
    return true;
  } catch {
    return true; // storage unavailable: still better to try once than never
  }
}
