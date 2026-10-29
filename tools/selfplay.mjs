// A simple robot plays whole games through the engine with the full
// catalogue - for crashes, tier unlocks, and a rough sense of pace.
// `yarn selfplay [games]`.
import {
  createGame, starterCards, facilityCards, goalCards, disasterCards, cityCards,
  calcStatTotal, effectiveCost, isCellEmpty, isBuildable, listConnectedEdges, evaluateCondition, previewPlacement, clearsOf
} from '@/game/core'

const GAMES = Number(process.argv[2] ?? 20)
const [T2, T3] = (process.env.TIERS ?? '12,22').split(',').map(Number)
const TIER_AT = { 2: T2, 3: T3 }
const START = [{ cardId: 'residential', x: 5, y: 3 }, { cardId: 'commercial', x: 6, y: 3 }, { cardId: 'industrial', x: 6, y: 4 }]
let seed = 1
const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

function play () {
  const game = createGame({
    cardCatalog: [...starterCards.STARTER_CARD_CATALOG, ...facilityCards.FACILITY_CATALOG, ...goalCards.GOAL_CATALOG, ...disasterCards.DISASTER_CATALOG, ...cityCards.CITY_CATALOG],
    startingDeckCardIds: starterCards.STARTER_DECK_CARDS,
    cityDeckCardIds: [...facilityCards.CITY_DECK_CARDS, ...cityCards.cityCardsOfTier(1)],
    cityTiers: [2, 3].map(tier => ({ tier, at: TIER_AT[tier], cardIds: cityCards.cityCardsOfTier(tier) })),
    goalDeckCardIds: goalCards.GOAL_DECK_CARDS, disasterCardIds: disasterCards.DISASTER_CARDS,
    baseRevenue: 0, populationTarget: 30, startingBuildings: START, rng
  })
  const s = game.state
  const pop = () => calcStatTotal(s, 'population')
  game.actions.advance()
  let turn = 1
  const tiers = {}
  for (; turn <= 60 && s.gameStatus === 'playing'; turn++) {
    // Build: clear status cards, play tokens and civics, then the best-value buildings, roads when stuck.
    for (let guard = 0; guard < 20; guard++) {
      const hand = s.hand
      const status = hand.find(c => c.type === 'status' && s.builtStructures.some(i => clearsOf(i.card).includes(c.id) && i.slots && i.slots.used < i.slots.capacity))
      if (status) { game.actions.clearStatus(status.id); continue }
      const civic = hand.find(c => c.type === 'civic' && !(c.effects?.onPlay ?? []).some(e => e.type === 'discardCards') && effectiveCost(s, c) <= s.treasury)
      if (civic) { game.actions.playCivicCard(civic.id); continue }
      const grid = s.cityGrid
      const cells = []
      for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) if (isCellEmpty(grid, x, y) && isBuildable(grid, x, y)) cells.push({ x, y })
      const builds = hand.filter(c => c.type === 'building' && !c.placesRoad && effectiveCost(s, c) <= s.treasury && !(c.unique && s.builtStructures.some(i => i.card.id === c.id)))
      if (builds.length && cells.length) {
        let best = null
        for (const c of builds) for (const at of cells) {
          const p = previewPlacement(s, c, at)
          const v = (p.delta.population ?? 0) * 1.5 + (p.delta.revenue ?? 0) * 2.4 + (p.delta.jobs ?? 0) * 0.5
          if (!best || v > best.v) best = { c, at, v }
        }
        game.actions.playCard(best.c.id, best.at); continue
      }
      const road = hand.find(c => c.placesRoad && effectiveCost(s, c) <= s.treasury)
      if (road) { const e = listConnectedEdges(grid); if (e.length) { const a = e[Math.floor(rng() * e.length)].key; const more = listConnectedEdges(grid, [a]); game.actions.playCard(road.id, { edges: more.length ? [a, more[0].key] : [a] }); continue } }
      break
    }
    game.actions.advance() // -> acquire
    const goal = game.goalRow.cards.find(g => evaluateCondition(g.condition, { state: s, catalog: game.catalog }))
    if (goal) game.actions.claimGoal(goal.id)
    while (s.buys > 0) {
      const affordable = game.cityRow.cards.filter(c => (c.price ?? c.cost) <= s.treasury).sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))
      if (!affordable.length) break
      game.actions.acquireCard(affordable[0].id)
    }
    for (let i = 0; i < 4; i++) game.actions.advance()
    for (const t of s.tiersUnlocked ?? []) if (!tiers[t]) tiers[t] = turn
  }
  return { status: s.gameStatus, turn, pop: pop(), buildings: s.builtStructures.length, deck: s.deck.drawPile.length + s.deck.discardPile.length + s.hand.length, tiers }
}

const results = []
for (let g = 0; g < GAMES; g++) { seed = g * 7919 + 1; results.push(play()) }
const won = results.filter(r => r.status === 'won')
const avg = (xs) => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length * 10) / 10 : '-'
console.log(`${GAMES} games: ${won.length} won, ${results.filter(r => r.status === 'lost').length} lost, ${results.filter(r => r.status === 'playing').length} unfinished`)
console.log(`won on turn ${avg(won.map(r => r.turn))} on average; final population ${avg(results.map(r => r.pop))}; buildings ${avg(results.map(r => r.buildings))}; deck ${avg(results.map(r => r.deck))}`)
console.log(`tier II reached on turn ${avg(results.filter(r => r.tiers[2]).map(r => r.tiers[2]))} (${results.filter(r => r.tiers[2]).length}/${GAMES}), tier III on turn ${avg(results.filter(r => r.tiers[3]).map(r => r.tiers[3]))} (${results.filter(r => r.tiers[3]).length}/${GAMES})`)
