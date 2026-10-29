// Matt: "it's harder for me to reload the page after you make changes...
// can we make it so [reopening the app] can also detect new changes and
// reload the page?" A standalone home-screen launch has no URL bar/reload
// button, and unlike a normal browser tab, iOS doesn't reliably re-fetch
// anything just because the app was brought back to the foreground - it
// can resume the exact same already-loaded page (and JS) indefinitely.
//
// Matt again, later: "All of our apps need the new version auto reload
// feature we have in Cinemaroll." This is that feature, ported from
// cinemaroll's own App.vue + utils/appUpdate.js. What changed from the
// first version of this file:
//
// 1. DETECTION is now "which app bundle is actually being served" rather
//    than version.json's git sha. Two reasons. The sha is not unique per
//    build - an uncommitted build stamps `<sha>-dirty`, so two different
//    dirty builds are indistinguishable - whereas js/app.<contenthash>.js
//    changes exactly when the code changes, which is the actual question.
//    And it needs no build-time cooperation at all: index.html always
//    names the bundle it wants, and this page can always read the bundle
//    it got off its own <script> tags. (public/version.json is still
//    written and deployed - it's just no longer what drives this.)
//    Deliberately NOT service-worker lifecycle hooks: with skipWaiting
//    (vue.config.js) a new worker activates immediately instead of sitting
//    in `installed`, so the `updated` hook is a race you often lose. This
//    comparison doesn't depend on worker timing at all.
//
// 2. TRIGGERS are now four, not one. visibilitychange alone is unreliable
//    on iOS, particularly for a home-screen-installed PWA - a long-standing
//    WebKit quirk means it sometimes just doesn't fire on foregrounding
//    (varies by iOS version, which is why this can silently work on one
//    iPhone and never on another). pageshow and window focus are more
//    consistent there, and a slow interval is a backstop that depends on no
//    lifecycle event firing at all.
//
// 3. APPLYING is now gated on the moment being safe, instead of reloading
//    the instant the app is foregrounded. The old version's "visibility ->
//    visible is guaranteed non-disruptive" assumption isn't true here: an
//    iOS PWA fires that on every glance back at a game you're in the middle
//    of. See appUpdate.js's isSafeMomentForReload for what "unsafe" means
//    in a game (short version: being on a game screen mid-play, ever).
//    Reload immediately only in the first few seconds after opening/
//    foregrounding - nothing is in flight yet - otherwise wait for a real
//    quiet stretch, and only ever try once per detected build.
//
// No special-casing for local dev: `yarn serve` serves an unhashed
// `js/app.js`, which currentBundleName() doesn't match, so the whole thing
// self-disables there rather than needing its own gate.
import { reloadForUpdate, isSafeMomentForReload, shouldAutoAttempt } from './appUpdate';

const RELOAD_MESSAGE_MS = 1200;
// "Just opened / just came back" - short enough that nothing can plausibly
// be in progress yet.
const FRESH_MOMENT_MS = 5000;
// No pointer/key/wheel/touch/scroll for this long counts as quiet.
const QUIET_MS = 25000;
const QUIET_POLL_MS = 5000;
const BACKSTOP_INTERVAL_MS = 30 * 60 * 1000;

// The hashed entry bundle, e.g. `js/app.1850a191.js` (verified against this
// repo's own production build output, not assumed). Webpack's contenthash is
// lowercase hex; the unhashed dev-server `js/app.js` deliberately does not
// match.
const BUNDLE_PATTERN = /js\/app\.[a-z0-9]+\.js/;

/** The app bundle THIS page is running, read off its own script tags. */
export function currentBundleName (root = document) {
  const scripts = Array.from(root.querySelectorAll('script[src]'));
  for (const script of scripts) {
    const match = (script.getAttribute('src') || '').match(BUNDLE_PATTERN);
    if (match) return match[0];
  }
  return null;
}

// Matt: "when new changes were discovered, it['d] give me a very brief
// message first. It just said something like new changes detected,
// reloading." Plain DOM injection (not a Vue component) since this needs
// to work regardless of which route/component tree happens to be mounted
// at the moment a new version is discovered.
export function showReloadToast () {
  const toast = document.createElement('div');
  toast.className = 'update-reload-toast';
  toast.textContent = 'New changes detected — reloading…';
  document.body.appendChild(toast);
}

// Returns a disposer (removes every listener and timer). main.js never calls
// it - the app never "un-initializes" - but tests do, since jsdom's
// `document` and `window` are shared and persistent across an entire test
// file: without this, each test's own initUpdateCheck() call would stack
// another set of listeners on top of every previous test's.
//
// `store` is optional and read-only - only for the two pieces of state the
// safety check needs (whether a game is live, whether we're at the table).
export function initUpdateCheck (store = null) {
  const runningBundle = currentBundleName();

  let lastActivityAt = Date.now();
  let lastBecameVisibleAt = Date.now();
  let quietTimer = null;
  let armed = false;

  const noteActivity = () => { lastActivityAt = Date.now(); };

  const safetyContext = () => ({
    gameState: store?.state?.game || null,
    atTable: Boolean(store?.state?.game),
  });

  function applyUpdate () {
    showReloadToast();
    setTimeout(() => { reloadForUpdate(); }, RELOAD_MESSAGE_MS);
  }

  // An update has been spotted. Decide when to actually take it.
  function armUpdate (targetBundle) {
    if (armed) return;
    // Once per detected build, ever - a reload that somehow doesn't land us
    // on the new bundle must not turn into a reload loop.
    if (!shouldAutoAttempt(targetBundle)) return;
    armed = true;

    if (Date.now() - lastBecameVisibleAt < FRESH_MOMENT_MS && isSafeMomentForReload(safetyContext())) {
      applyUpdate();
      return;
    }

    // Otherwise: wait for a stretch with no interaction AND a safe screen.
    // If that never comes (a game left open forever), we simply never
    // reload - which is the correct outcome, not a failure.
    quietTimer = setInterval(() => {
      if (Date.now() - lastActivityAt < QUIET_MS) return;
      if (!isSafeMomentForReload(safetyContext())) return;
      clearInterval(quietTimer);
      quietTimer = null;
      applyUpdate();
    }, QUIET_POLL_MS);
  }

  async function checkForUpdate () {
    if (armed || !runningBundle) return;
    try {
      const res = await fetch(`${process.env.BASE_URL || '/'}index.html?updateCheck=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      // The cache-busting param matters: index.html is served through the
      // service worker's NetworkFirst navigate handler, and a stale cached
      // copy can never answer "what's live right now."
      const match = (await res.text()).match(BUNDLE_PATTERN);
      if (match && match[0] !== runningBundle) armUpdate(match[0]);
    } catch {
      // Offline/transient (or local dev) - try again on the next trigger
      // rather than risking anything on bad data.
    }
  }

  function onVisibilityChange () {
    if (document.visibilityState !== 'visible') return;
    lastBecameVisibleAt = Date.now();
    checkForUpdate();
  }

  function onPageShow () {
    lastBecameVisibleAt = Date.now();
    checkForUpdate();
  }

  const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('focus', checkForUpdate);
  ACTIVITY_EVENTS.forEach((eventName) => {
    // Passive: activity tracking must never delay a scroll or a tap.
    window.addEventListener(eventName, noteActivity, { passive: true });
  });
  const backstop = setInterval(checkForUpdate, BACKSTOP_INTERVAL_MS);

  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('focus', checkForUpdate);
    ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, noteActivity));
    clearInterval(backstop);
    if (quietTimer) clearInterval(quietTimer);
  };
}
