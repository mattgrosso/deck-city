// Shared by the playtest scripts: firebase-admin from .env.local, and which
// session to act on (--session, else the one with the newest line).
import { readFileSync } from 'fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'

export const ROOT = 'deckCityPlaytest'

export const db = (() => {
  const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH
  const databaseURL = process.env.VUE_APP_FIREBASE_DATABASE_URL
  if (!keyPath || !databaseURL) { console.error('Needs FIREBASE_ADMIN_KEY_PATH and VUE_APP_FIREBASE_DATABASE_URL in .env.local'); process.exit(1) }
  initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))), databaseURL })
  return getDatabase()
})()

export const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null }
export const shortId = (key) => key.slice(-5)

/** --session, else the session switched on most recently spoken in (or any, with `ended`). */
export async function liveSession ({ ended = false } = {}) {
  const given = arg('session')
  if (given) return given
  const all = (await db.ref(ROOT).get()).val() || {}
  let best = null; let bestAt = 0
  for (const [id, s] of Object.entries(all)) {
    if (!s?.on && !ended) continue
    const newest = Math.max(1, ...Object.values(s.lines || {}).map(l => l.at || 0))
    if (newest >= bestAt) { best = id; bestAt = newest }
  }
  return best
}

const clock = (t) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })

/** One line as the watcher and the transcript print it. */
export function fmt (key, l, { hand = false } = {}) {
  const where = [l.screen === 'title' ? 'title' : `t${l.turn ?? '?'}`, l.era ? `era ${l.era}` : null, l.mode, l.card ? `on ${l.card}` : null, l.budget != null ? `budget ${l.budget}` : null, l.patience != null ? `patience ${l.patience}` : null].filter(Boolean).join(' · ')
  return `#${shortId(key)} ${clock(l.at || Date.now())} [${where}] ${l.text}${hand && l.hand ? `\n      hand: ${l.hand}` : ''}`
}
