// A simple robot plays whole games through the engine with the full
// catalogue - for crashes, tier unlocks, and a rough sense of pace.
// `yarn selfplay [games]`.
import { runGameOptions } from '@/game/runSetup'
import { valueOfBuild } from '@/game/core/economy/priceList'
import {
  createGame,
  POLICIES, calcStatTotal, calcUpkeep, slotCapacity, policyPrice, marketPrice, effectiveCost, canCombine, canCombinePair, combineCost, choosePlacement, evaluateCondition, clearsOf, MONTH
} from '@/game/core'

const GAMES = Number(process.argv[2] ?? 20)
let seed = 1
const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

function play () {
  const opts = runGameOptions({ rng })
  if (process.env.HAND) opts.handSize = Number(process.env.HAND)
  if (process.env.SLOTS) opts.cardCatalog = opts.cardCatalog.map(c => c.clears ? { ...c, slots: { capacity: (c.slots?.capacity ?? 1) + Number(process.env.SLOTS) } } : c)
  if (process.env.NOBUILDSTATUS) opts.cardCatalog = opts.cardCatalog.map(c => c.type === 'building' && c.effects?.onBuild ? { ...c, effects: { ...c.effects, onBuild: c.effects.onBuild.filter(e => e.type !== 'gainStatus' || e.amount > 1).map(e => e.type === 'gainStatus' ? { ...e, amount: e.amount - 1 } : e) } } : c)
  const game = createGame(opts)
  const s = game.state
  const pop = () => calcStatTotal(s, 'population')
  game.actions.advance()
  // FORCE=<policy id>: start with just that policy and take no others (to measure one); NOPICK=1: none at all.
  if (process.env.FORCE || process.env.NOPICK) { s.policies = process.env.FORCE ? [POLICIES.find(p => p.id === process.env.FORCE)] : []; s.run.policyOffer = []; s.policyForSale = null; s.run.policyQueue = [] }
  let turn = 1
  for (; turn <= 200 && s.gameStatus === 'playing'; turn++) {
    if (process.env.FORCE || process.env.NOPICK) { s.run.policyOffer = []; s.run.policyQueue = []; s.policyForSale = null }
    while (s.run?.policyOffer?.length) game.actions.choosePolicy(s.run.policyOffer[Math.floor(rng() * s.run.policyOffer.length)].id)
    if (s.run?.status === 'choosing') game.actions.chooseMandate(s.run.offer[0].id)
    // Build: clear status cards, play tokens and civics, then the best-value buildings, roads when stuck.
    if (process.env.TRACE && turn % 4 === 0) console.log(`t${turn} budget ${s.treasury} hand ${s.hand.map(c => `${c.id}(${effectiveCost(s, c)})`).join(' ')}`)
    for (let guard = 0; guard < 20; guard++) {
      const hand = s.hand
      const status = hand.find(c => c.type === 'status' && s.builtStructures.some(i => clearsOf(i.card).includes(c.id) && i.slots && i.slots.used < slotCapacity(s, i)))
      if (status) { game.actions.clearStatus(status.id); continue }
      const civic = hand.find(c => c.type === 'civic' && !(c.effects?.onPlay ?? []).some(e => e.type === 'discardCards') && effectiveCost(s, c) <= s.treasury)
      if (civic) { game.actions.playCivicCard(civic.id); continue }
      // The city places what it builds (state/autoPlace.js): the robot only
      // picks which card, the one whose best spot scores highest.
      const builds = hand.filter(c => c.type === 'building' && !c.placesRoad && effectiveCost(s, c) <= s.treasury && !(c.unique && s.builtStructures.some(i => i.card.id === c.id)))
      if (builds.length) {
        let best = null
        for (const c of builds) {
          const spot = choosePlacement(s, c)
          const v = spot ? spot.score : (c.clears && s.builtStructures.some(i => i.card.id === c.id) ? 1 : null)
          if (v != null && (!best || v > best.v)) best = { c, v }
        }
        if (best) { game.actions.playCard(best.c.id); PLAYS.n++; continue }
      }
      // Nothing left worth building: combine two leftover buildings if the budget allows.
      if (process.env.COMBINE !== '0') {
        const ok = hand.filter(canCombine)
        const pair = ok.flatMap((x, i) => ok.slice(i + 1).filter(y => canCombinePair(x, y)).map(y => [x, y]))[0]
        if (pair && s.treasury >= combineCost(pair[0], pair[1])) { game.actions.combineCards(pair[0].id, pair[1].id, 0); COMBOS.n++; continue }
      }
      break
    }
    if (process.env.TRACE && turn % 4 === 0) console.log(`   after build: budget ${s.treasury} hand ${s.hand.map(c => c.id).join(' ')} buildings ${s.builtStructures.length}`)
    game.actions.advance() // -> acquire
    if (s.run?.status === 'playing' && s.run.mandate && evaluateCondition(s.run.mandate.condition, { state: s, catalog: game.catalog }) && process.env.EARLY !== '0') {
      game.actions.callElection()
      if (s.gameStatus !== 'playing') break
      if (process.env.FORCE || process.env.NOPICK) { s.run.policyOffer = []; s.run.policyQueue = []; s.policyForSale = null }
      if (s.run.policyOffer?.length) game.actions.choosePolicy(s.run.policyOffer[0].id)
      game.actions.chooseMandate(s.run.offer[0].id)
    }
    // Month's end (game.js MONTH): keep the best of the three offered, then shop.
    const market = s.week === MONTH
    if (s.monthOffer?.length) game.actions.chooseOffer(s.monthOffer.map(c => ({ c, v: valueOfBuild(c).value })).sort((a, b) => b.v - a.v)[0].c.id)
    // Spare budget at the end of buying? The policy for sale.
    if (market && process.env.NOSHOP !== '1' && s.policyForSale && s.treasury >= policyPrice(s) + 4) game.actions.buyPolicy()
    const goal = game.goalRow.cards.find(g => evaluateCondition(g.condition, { state: s, catalog: game.catalog }))
    if (goal) game.actions.claimGoal(goal.id)
    // Buy: the best value for money, but a clearer first for whatever bad
    // card is piling up and nothing yet clears.
    const badKinds = ['crime', 'trash', 'pollution', 'debt'].map(k => [k, s.deck.drawPile.concat(s.deck.discardPile).filter(c => c.id === k).length]).sort((a, b) => b[1] - a[1])
    const deckOwns = (c) => s.deck.drawPile.concat(s.deck.discardPile, s.hand).some(x => x.id === c.id)
    while (market && s.buys > 0) {
      const affordable = game.cityRow.cards.filter(c => marketPrice(s, c) <= s.treasury)
      const services = game.supply.filter(c => !c.placesRoad && marketPrice(s, c) <= s.treasury)
      if (!affordable.length && !services.length) break
      const worst = badKinds[0]
      const clearer = worst[1] >= 3 && [...affordable, ...services].find(c => clearsOf(c).includes(worst[0]) && !deckOwns(c) && !s.builtStructures.some(i => clearsOf(i.card).includes(worst[0])))
      const best = clearer || affordable.map(c => ({ c, v: valueOfBuild(c).value / ((c.price ?? 1) + (c.cost ?? 0) + 1) })).sort((a, b) => b.v - a.v)[0]?.c
      if (!best || (!clearer && valueOfBuild(best).value < (best.cost ?? 0))) break
      game.actions.acquireCard(best.id)
    }
    if (process.env.MONEY) { MONEY[turn] = MONEY[turn] ?? []; MONEY[turn].push([s.treasury, calcStatTotal(s, "revenue"), s.builtStructures.length, calcUpkeep(s)]) }
    for (let i = 0; i < 4; i++) game.actions.advance()
    for (const [label, v] of s.run?.lastDrain?.parts ?? []) { const k = label.replace(/^\d+ /, ''); DRAIN[k] = DRAIN[k] ?? [0, 0]; DRAIN[k][0] += v; DRAIN[k][1]++ }
    DRAIN.__turns = (DRAIN.__turns ?? 0) + 1
  }
  const deckAll = s.deck.drawPile.concat(s.deck.discardPile, s.hand)
  if (process.env.DECK) { const c = {}; for (const x of deckAll) c[x.id] = (c[x.id] ?? 0) + 1; console.log(Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ' ' + v).join(', '), '| policies:', s.policies.map(p => p.id).join(' ')) }
  STATS.push({ policies: s.policies.length, streets: s.cityGrid.roads.size, bad: deckAll.filter(c => c.type === 'status' || c.type === 'disaster').length, buildingsCards: deckAll.filter(c => c.type === 'building').length, civic: deckAll.filter(c => c.type === 'civic').length, clearers: s.builtStructures.filter(i => clearsOf(i.card).length).length, budget: calcStatTotal(s, 'revenue'), jobs: calcStatTotal(s, 'jobs'), plays: PLAYS.n / Math.max(1, turn) })
  PLAYS.n = 0
  return { status: s.gameStatus, turn, pop: pop(), buildings: s.builtStructures.length, deck: s.deck.drawPile.length + s.deck.discardPile.length + s.hand.length, elections: s.run.elections.map(e => ({ era: e.era, mandate: e.mandate.id, passed: e.passed, early: e.early, turn: e.turn })) }
}

const results = []
const DRAIN = {}
const STATS = []
const PLAYS = { n: 0 }
const MONEY = {}
const COMBOS = { n: 0 }
for (let g = 0; g < GAMES; g++) { seed = g * 7919 + 1; results.push(play()) }
const avg = (xs) => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length * 10) / 10 : '-'
console.log(`${GAMES} runs: ${results.filter(r => r.status === 'won').length} won all three eras, ${results.filter(r => r.status === 'lost').length} lost, ${results.filter(r => r.status === 'playing').length} unfinished; run length ${avg(results.map(r => r.turn))} turns`)
for (const era of [1, 2, 3]) {
  const es = results.flatMap(r => r.elections.filter(e => e.era === era))
  const starts = results.map(r => { const prev = r.elections.find(e => e.era === era - 1); return prev ? prev.turn : 0 })
  const lengths = results.map((r, i) => { const e = r.elections.find(x => x.era === era); return e ? e.turn - starts[i] : null }).filter(x => x !== null)
  const fails = es.filter(e => !e.passed).map(e => e.mandate)
  console.log(`era ${era}: ${es.filter(e => e.passed).length}/${es.length} passed (${es.filter(e => e.early).length} early), ${avg(lengths)} turns long${fails.length ? `; failed: ${fails.join(', ')}` : ''}`)
}
console.log(`combines ${COMBOS.n} (${Math.round(COMBOS.n / GAMES)} a run)`)
console.log(`final population ${avg(results.map(r => r.pop))}, buildings ${avg(results.map(r => r.buildings))}, deck ${avg(results.map(r => r.deck))}`)

console.log('patience drain per turn, on average: ' + Object.entries(DRAIN).filter(([k]) => k !== '__turns').map(([k, [sum]]) => `${k} ${Math.round(sum / DRAIN.__turns * 10) / 10}`).join(', '))

console.log('at the end, on average: ' + Object.keys(STATS[0]).map(k => `${k} ${avg(STATS.map(x => x[k]))}`).join(', '))
if (process.env.MONEY) for (const t of [1, 5, 10, 20, 30, 45, 60]) if (MONEY[t]) console.log(`turn ${t}: unspent ${avg(MONEY[t].map(x => x[0]))}, revenue ${avg(MONEY[t].map(x => x[1]))}, upkeep ${avg(MONEY[t].map(x => x[3]))}, buildings ${avg(MONEY[t].map(x => x[2]))}`)
