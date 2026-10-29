// The whole transcript of a playtest, to read and react to afterwards:
// `yarn playtest:transcript` (the latest session) writes
// playtest-live/<session>.md and prints its path. `--session <id>` for another.
import { mkdirSync, writeFileSync } from 'fs'
import { db, ROOT, liveSession, fmt } from './playtest-common.mjs'

const session = await liveSession({ ended: true })
if (!session) { console.error('No playtest session found'); process.exit(1) }
const data = (await db.ref(`${ROOT}/${session}`).get()).val() || {}
const items = [
  ...Object.entries(data.lines || {}).map(([k, l]) => ({ at: l.at || 0, text: fmt(k, l, { hand: true }) })),
  ...Object.values(data.notes || {}).map(n => ({ at: n.at || 0, text: `   CLAUDE: ${n.text}` }))
].sort((a, b) => a.at - b.at)
const first = items[0]?.at
const out = [`# Deck City playtest ${session}`, '', first ? `Started ${new Date(first).toString()}; ${Object.keys(data.lines || {}).length} lines.` : 'No lines yet.', '', '```', ...items.map(i => i.text), '```', ''].join('\n')
const dir = new URL('../playtest-live/', import.meta.url).pathname
mkdirSync(dir, { recursive: true })
writeFileSync(`${dir}${session}.md`, out)
console.log(`${dir}${session}.md`)
process.exit(0)
