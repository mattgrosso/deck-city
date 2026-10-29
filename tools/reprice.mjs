// THE REPRICER: `yarn reprice` sets the cost of every card in
// src/game/core/cards/cityCards.js written with `null` (or every card, with
// --all) to the whole number that lands it on the economy's line - aiming at
// a ratio of TARGET, never below FAIR.low - and writes it into the file.
// Cards it cannot land (worth almost nothing, or worth so much that even the
// best cost overshoots) are listed for a person to fix.
import { readFileSync, writeFileSync } from 'node:fs'
import { CITY_CARDS } from '@/game/core/cards/cityCards'
import { valueOfBuild } from '@/game/core/economy/priceList'
import { FAIR, CARD_SLOT } from '@/game/core/economy/economy'

const TARGET = 1.15
const all = process.argv.includes('--all')
const file = new URL('../src/game/core/cards/cityCards.js', import.meta.url)
let src = readFileSync(file, 'utf8')
const report = []
for (const card of CITY_CARDS) {
  if (!all && card.cost !== null) continue
  const value = valueOfBuild(card).value
  const slot = card.type === 'civic' ? CARD_SLOT : 0
  let best = null
  // A building costs at least 1; a civic card may be free (its hand slot is its price).
  for (let c = slot ? 0 : 1; c <= 40; c++) {
    const r = value / (c + slot)
    if (r < FAIR.low) break
    if (best === null || Math.abs(r - TARGET) < Math.abs(best.r - TARGET)) best = { c, r }
  }
  if (!best || best.r > FAIR.high || best.r < FAIR.low) { report.push(`${card.id}: worth ${value}, no cost lands it (best ${best ? `${best.c} at ${best.r.toFixed(2)}` : 'none'})`); if (!best) continue }
  const fn = card.type === 'civic' ? 'C' : 'B'
  const re = fn === 'B'
    ? new RegExp(`(B\\('${card.id}', '[^']*', \\d, \\[[^\\]]*\\], )(null|\\d+)`)
    : new RegExp(`(C\\('${card.id}', '[^']*', \\d, )(null|\\d+)`)
  if (!re.test(src)) { report.push(`${card.id}: could not find it in the file`); continue }
  src = src.replace(re, `$1${best.c}`)
}
writeFileSync(file, src)
console.log(report.length ? report.join('\n') : 'every card landed on the line')
