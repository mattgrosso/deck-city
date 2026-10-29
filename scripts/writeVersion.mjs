// Runs before every build (see package.json's "build"/"deploy" scripts) -
// writes public/version.json, copied into dist/ as a plain static file and
// fetched fresh (cache: no-store) at runtime by src/utils/checkForUpdate.js
// to detect "a newer build than the one currently running is live."
//
// Deliberately does NOT also bake a value into the JS bundle itself
// (an earlier version of this script wrote a second, redundant
// VUE_APP_VERSION via .env.production.local) - vue.config.js already does
// exactly that, computing VUE_APP_GIT_SHA the same way for Landing.vue's
// own version footer. checkForUpdate.js and GameBoard.vue's version tag
// both read that existing VUE_APP_GIT_SHA instead, so there's one source
// of "what build is this" baked into the client, not two that could drift.
//
// The hash+dirty-suffix logic below is intentionally duplicated from
// vue.config.js's own copy, not shared via an import - vue.config.js is
// CommonJS (Vue CLI's own requirement) and this is an ESM script; fighting
// that interop isn't worth it for five lines. If the versioning scheme
// here ever changes, update both.
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

// Which git to run.
//
// execSync resolves a bare `git` through /bin/sh's PATH, which on this machine
// finds Intel Homebrew's /usr/local/bin/git first - and that binary dies with
// "Bad CPU type in executable" on arm64. The old code caught that and fell
// back to 'unknown' SILENTLY, so every deploy stamped version.json and
// VUE_APP_GIT_SHA with "unknown" and nobody noticed (found 2026-09-17: every
// game on the hub was serving {"version":"unknown"}).
//
// Try known-good binaries in order, and if none works SAY SO rather than
// quietly shipping a build that cannot identify itself.
const GIT_CANDIDATES = ['/opt/homebrew/bin/git', '/usr/bin/git', 'git'];

function resolveGit () {
  for (const bin of GIT_CANDIDATES) {
    try {
      execSync(`${bin} --version`, { stdio: 'pipe' });
      return bin;
    } catch { /* try the next one */ }
  }
  return null;
}

const GIT = resolveGit();
if (!GIT) console.warn('[version] no working git found - build will be stamped "unknown"');

function safeGit (args, fallback) {
  if (!GIT) return fallback;
  try {
    return execSync(`${GIT} ${args}`, { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch (error) {
    // A build must never fail just because a version identifier could not be
    // computed - but it must not pretend either.
    console.warn(`[version] git ${args} failed: ${error.message.split('\n')[0]}`);
    return fallback;
  }
}

const gitSha = safeGit('rev-parse --short HEAD', 'unknown');
const isDirty = safeGit('status --porcelain', '') !== '';
const version = gitSha + (isDirty ? '-dirty' : '');

writeFileSync(join(rootDir, 'public', 'version.json'), `${JSON.stringify({ version })}\n`);

console.log(`Stamped public/version.json: ${version}`);
