// Answer on the TV during a playtest: `yarn playtest:say "Fixed: ..."`.
// Shown in the Claude box over the game for ~20s. `--session <id>` to pick one.
import { db, ROOT, liveSession } from './playtest-common.mjs'
import { ServerValue } from 'firebase-admin/database'

const text = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--session').join(' ').trim()
if (!text) { console.error('Usage: yarn playtest:say "message"'); process.exit(1) }
const session = await liveSession({ ended: true })
if (!session) { console.error('No playtest session found'); process.exit(1) }
await db.ref(`${ROOT}/${session}/notes`).push({ text, at: ServerValue.TIMESTAMP })
console.log(`said on ${session}: ${text}`)
process.exit(0)
