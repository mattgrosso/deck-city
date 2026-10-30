import { describe, it, expect } from 'vitest'
import { createGame, calcStatTotal, effectiveCost } from '../index'
import { rulesFor } from '@/ui/cardText'

// Small made-up cards that each use one piece of the synergy vocabulary.
const B = (id, tags, o = {}) => ({ id, type: 'building', name: id, tags, cost: 1, stats: {}, ...o })
const CARDS = [
  { id: 'road', type: 'building', name: 'Road', cost: 0, placesRoad: true, roadSegments: 2, tags: ['infrastructure'] },
  B('house', ['residential'], { stats: { population: 1 } }),
  B('shop', ['commercial'], { stats: { revenue: 1 } }),
  B('grower', ['commercial'], { effects: { onNeighborBuilt: [{ type: 'growSelf', stat: 'revenue', amount: 1, max: 2, ifTag: 'residential' }] } }),
  B('watcher', ['service'], { effects: { onCityBuilt: [{ type: 'gainTreasury', amount: 2, ifTag: 'residential' }] } }),
  B('arcade', ['commercial'], { freeFirst: 'commercial' }),
  B('drummer', ['leisure'], { every: 2, effects: { onNthPlay: [{ type: 'gainTreasury', amount: 3 }] } }),
  B('polluter', ['industrial'], { adjacency: { statBonus: [{ stat: 'revenue', amount: 1, targetTag: 'pollution', scope: 'deck', max: 3 }] } }),
  { id: 'pollution', type: 'status', name: 'Pollution', tags: ['negative', 'pollution'] }
]
const setup = () => {
  const game = createGame({ cardCatalog: CARDS, startingDeckCardIds: ['house', 'house', 'house', 'shop', 'shop'], handSize: 5, baseRevenue: 0, shuffleStartingDeck: false, gridSize: { width: 6, height: 4 }, startingRoadEdges: ['h:0,2', 'h:1,2', 'h:2,2', 'h:3,2', 'h:4,2', 'h:5,2'] })
  game.actions.advance() // deal; build phase
  game.state.treasury = 50
  return game
}
const build = (game, id, x, y) => { game.state.hand.push(game.catalog[id]); return game.actions.playCard(id, { x, y }) }

describe('synergy', () => {
  it('growSelf, filtered: grows only for the right neighbour, and stops at its cap', () => {
    const game = setup()
    const g = build(game, 'grower', 1, 1)
    build(game, 'shop', 2, 1) // not a home: no growth
    expect(g.growth?.revenue ?? 0).toBe(0)
    build(game, 'house', 0, 1); build(game, 'house', 1, 2); build(game, 'house', 2, 2) // only two touch it
    expect(g.growth.revenue).toBe(2)
    expect(calcStatTotal(game.state, 'revenue')).toBe(1 + 2) // the shop, and the grower's growth
  })

  it('onCityBuilt watches the whole city, and only what its filter names', () => {
    const game = setup()
    build(game, 'watcher', 5, 1)
    const before = game.state.treasury
    build(game, 'shop', 0, 1)
    build(game, 'house', 1, 1)
    expect(game.state.treasury).toBe(before - 1 - 1 + 2)
  })

  it('freeFirst: the first shop each turn is free, the second is not, and a new turn resets it', () => {
    const game = setup()
    build(game, 'arcade', 0, 1) // the arcade itself is the first shop: free too
    expect(effectiveCost(game.state, game.catalog.shop)).toBe(1)
    for (let i = 0; i < 5; i++) game.actions.advance() // round to the next build phase
    expect(effectiveCost(game.state, game.catalog.shop)).toBe(0)
  })

  it('onNthPlay fires on every second card played', () => {
    const game = setup()
    build(game, 'drummer', 0, 1) // play 1
    const before = game.state.treasury
    build(game, 'house', 1, 1) // play 2: +3
    build(game, 'house', 2, 1) // play 3
    build(game, 'house', 3, 1) // play 4: +3
    expect(game.state.treasury).toBe(before - 3 + 6)
  })

  it('a deck rule counts cards in the deck', () => {
    const game = setup()
    const p = build(game, 'polluter', 0, 1)
    expect(calcStatTotal(game.state, 'revenue')).toBe(0)
    game.state.deck.discardPile.push(game.catalog.pollution, game.catalog.pollution, game.catalog.pollution, game.catalog.pollution)
    expect(calcStatTotal(game.state, 'revenue')).toBe(3) // capped at 3
    expect(p).toBeTruthy()
  })

  it('reads in plain words', () => {
    const cat = Object.fromEntries(CARDS.map(c => [c.id, c]))
    expect(rulesFor(cat.grower, cat)).toContain('When a home is built next door: this grows +1 revenue for good (up to +2).')
    expect(rulesFor(cat.watcher, cat)).toContain('Whenever you build a home: +2 budget.')
    expect(rulesFor(cat.arcade, cat)).toContain('The first shop you build each turn costs 0.')
    expect(rulesFor(cat.drummer, cat)).toContain('Every second card you play in a turn: +3 budget.')
    expect(rulesFor(cat.polluter, cat)).toContain('+1 revenue for each Pollution card in your deck (up to 3).')
  })
})
