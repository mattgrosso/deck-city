// "Am I looking at new code?" - answered without opening devtools.
//
// House standard (Matt, 2026-08-22): "On lots of our apps, we have either a
// version number or a timestamp that tells me when the last version was
// loaded so I can see if I'm looking at new code. We should make that a
// blanket policy across all the apps and implement it everywhere." One muted
// line, same wording in every app: `<version> · built Mon D, h:mm AM/PM`.
//
// It's the human-readable counterpart to the auto-update check in
// checkForUpdate.js: after a deploy, this is how you tell whether the tab in
// front of you actually picked up the new code.
//
// The timestamp is stamped at BUILD time, not page-load time - that's the
// distinction that makes it useful. A tab left open for a week keeps showing
// the build it is still running, so a stale one is obvious at a glance. (A
// relative "X ago" string was tried in Thunderstone first and Matt asked for
// an absolute date/time instead: "the problem with that is it doesn't update,
// so it's better for me if you just put the actual date and time of the last
// update.")
//
// Both halves come from what vue.config.js already bakes in
// (VUE_APP_GIT_SHA / VUE_APP_BUILD_TIME) - no second timestamp, and no
// second version identifier that could drift from the one checkForUpdate.js
// compares against version.json.

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const pad = (n) => String(n).padStart(2, '0');

// "Aug 22, 1:32 AM" - local time, because the question is always "is this
// newer than the deploy I just did?", which is asked in local time. The year
// appears only when it isn't the current one, so the common case stays short.
export const formatBuildTime = (value, now = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (!value || Number.isNaN(date.getTime())) return null;

  const hour24 = date.getHours();
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const meridiem = hour24 < 12 ? 'AM' : 'PM';
  const year = date.getFullYear() === now.getFullYear() ? '' : `, ${date.getFullYear()}`;
  return `${MONTHS[date.getMonth()]} ${date.getDate()}${year}, ${hour}:${pad(date.getMinutes())} ${meridiem}`;
};

// This repo has no meaningful semver (package.json sits at a private 0.1.0
// and never moves), so the version identifier is the short git SHA - the same
// one version.json carries. A SHA gets no "v" prefix, because "va1b2c3d"
// would be nonsense; a real semver keeps it, so the house format reads the
// same in the apps that do have one.
const SEMVER = /^\d+\.\d+/;
export const formatVersion = (version) => {
  if (!version) return null;
  return SEMVER.test(version) ? `v${version}` : version;
};

// The one line every app renders: "a1b2c3d · built Aug 22, 1:32 AM".
// Degrades rather than disappearing - a missing version or an unparseable
// timestamp still leaves something true on screen.
export const buildStampText = ({ version, buildTime, now } = {}) => {
  const label = formatVersion(version);
  const when = formatBuildTime(buildTime, now);
  const parts = [];
  if (label) parts.push(label);
  if (when) parts.push(`built ${when}`);
  return parts.join(' · ');
};

// Baked in by vue.config.js at build time; both are absent under vitest,
// which is exactly the degraded case above.
export const buildStamp = () => buildStampText({
  version: process.env.VUE_APP_GIT_SHA,
  buildTime: process.env.VUE_APP_BUILD_TIME,
});

// TAPPING THE STAMP RELOADS THE APP. Matt, 2026-09-19: "when we were
// building Space Base ages ago, we built in a thing where I could tap on the
// version number and it would force a refresh... it would be nice if tapping
// on a version number on any of our apps would refresh the app. Because you
// can't really refresh when you're in an installed app on the iPhone."
//
// That last sentence is the whole reason this exists: a home-screen PWA has
// no URL bar and no reload button, so when the update check has not yet
// noticed a deploy - or is waiting for a quiet moment - there is no way to
// ask for the new code by hand.
//
// A plain location.reload() is not enough there: the service worker will
// happily serve the same precached bundle back. So the caches go first, and
// any worker that is sitting in `waiting` is told to take over. Every step
// is best-effort - whatever fails, the reload still happens, because a tap
// that does nothing at all is the one outcome that must not be possible.
export const forceRefresh = async () => {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) || [];
    await Promise.all(regs.map((r) => r.update().catch(() => {})));
    regs.forEach((r) => r.waiting?.postMessage?.({ type: 'SKIP_WAITING' }));
    if (window.caches?.keys) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k).catch(() => {})));
    }
  } catch {
    // Never let the housekeeping cost us the reload.
  }
  window.location.reload();
};
