// Tail a playtest as it happens: every line the TV hears, with where the
// game was. `yarn playtest:watch` (newest switched-on session; waits for one),
// `--session <id>`, `--all` to replay the session from the start first.
import { db, ROOT, liveSession, fmt, arg } from './playtest-common.mjs'

let session = await liveSession()
if (!session) console.log('No playtest switched on yet; waiting (pause menu → Playtest mode, or P).')
while (!session) {
  await new Promise(resolve => setTimeout(resolve, 10000))
  session = await liveSession()
}
console.log(`PLAYTEST ${session} — listening`)
const since = process.argv.includes('--all') ? 0 : Date.now() - 5000
db.ref(`${ROOT}/${session}/lines`).on('child_added', (snap) => { if ((snap.val().at || 0) >= since) console.log(fmt(snap.key, snap.val(), { hand: true })) })
db.ref(`${ROOT}/${session}/on`).on('value', (snap) => { if (snap.val() === false) { console.log(`PLAYTEST ENDED ${session}`); if (!arg('session')) process.exit(0) } })
