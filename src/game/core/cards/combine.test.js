import { describe, it, expect } from 'vitest'
import { combineOptions, combineCost, canCombine, canCombinePair, NAMES, buildingFamily } from './combine'
import { createGame, calcStatTotal } from '../index'
import { runGameOptions } from '@/game/runSetup'
import { CITY_CATALOG } from './cityCards'
import { STARTER_CARD_CATALOG } from './starterCards'

const card = (id) => [...CITY_CATALOG, ...STARTER_CARD_CATALOG].find(c => c.id === id)

describe('combining', () => {
  it('names every pair of building families, both ways round', () => {
    const fams = ['commercial', 'facility', 'green', 'industrial', 'landmark', 'leisure', 'residential', 'transit']
    for (const a of fams) for (const b of fams) if (a <= b) expect(NAMES[`${a}+${b}`], `${a}+${b}`).toHaveLength(2)
    expect(Object.keys(NAMES)).toHaveLength(36)
  })

  it('a home and a shop: both stats, both abilities, both tags, a lean either way', () => {
    const home = card('residential'); const shop = card('commercial')
    const [a, b] = combineOptions(home, shop)
    expect([a.name, b.name]).toEqual(['Main Street Shops', 'Mixed-Use Block'])
    expect(a.tags).toEqual(expect.arrayContaining(['residential', 'commercial']))
    for (const k of ['population', 'jobs', 'revenue']) expect((a.stats[k] ?? 0) + (b.stats[k] ?? 0)).toBe(2 * ((home.stats[k] ?? 0) + (shop.stats[k] ?? 0)) + (k === 'revenue' || k === 'population' ? 1 : 0))
    expect(a.stats.revenue).toBe((home.stats.revenue ?? 0) + (shop.stats.revenue ?? 0) + 1)
    expect(b.stats.population).toBe((home.stats.population ?? 0) + (shop.stats.population ?? 0) + 1)
    expect(a.adjacency.statBonus.length).toBe((home.adjacency?.statBonus ?? []).length + (shop.adjacency?.statBonus ?? []).length)
    expect(a.family).toBe('commercial'); expect(b.family).toBe('residential')
    expect(combineOptions(shop, home).map(c => c.id)).toEqual([a.id, b.id]) // order in hand doesn't matter
  })

  it('every pair in the catalogue combines into something buildable', () => {
    const buildings = [...CITY_CATALOG, ...STARTER_CARD_CATALOG].filter(canCombine)
    for (const x of buildings.slice(0, 40)) for (const y of buildings.slice(40, 80)) {
      const opts = combineOptions(x, y)
      expect(opts).toHaveLength(2)
      for (const o of opts) { expect(o.name).toBeTruthy(); expect(o.cost).toBe((x.cost ?? 0) + (y.cost ?? 0)); expect(o.size).toBe(2) }
    }
    expect(buildingFamily(card('residential'))).toBe('residential')
  })

  it('combined cards combine again, two of a size: pair, Quarter, District, Borough', () => {
    const home = card('residential'); const shop = card('commercial'); const mill = card('industrial')
    const mixed = combineOptions(home, shop)[1] // Mixed-Use Block, leans residential
    const company = combineOptions(home, mill)[1] // Loft Conversion, leans residential
    expect(canCombinePair(mixed, mill)).toBe(false)
    expect(canCombinePair(mixed, company)).toBe(true)
    const q = combineOptions(mixed, company)
    expect(q.map(c => c.name)).toEqual(['Residential Quarter', 'Old Residential Quarter'])
    expect(q[0].size).toBe(4)
    expect(q[0].stats.population).toBe(mixed.stats.population + company.stats.population + 1)
    expect(q[0].lookAs.id).not.toMatch(/^combo:/)
    const d = combineOptions(q[0], q[1])[0]
    expect(d.size).toBe(8); expect(d.name).toBe('Residential District')
    const b = combineOptions(d, d)[0]
    expect(b.size).toBe(16); expect(b.name).toBe('Residential Borough')
    expect(b.id.length).toBeLessThan(30)
  })

  it('in a game: pay, both leave for good, the chosen card goes to the discard pile and builds', () => {
    const game = createGame({ ...runGameOptions(), shuffleStartingDeck: false, terrain: null })
    const s = game.state
    game.actions.advance()
    game.actions.chooseMandate(s.run.offer[0].id)
    s.hand.splice(0, s.hand.length, card('residential'), card('commercial'), card('road'))
    s.treasury = 20
    const deckBefore = s.deck.drawPile.length + s.deck.discardPile.length + s.hand.length
    const cost = combineCost(card('residential'), card('commercial'))
    const made = game.actions.combineCards('residential', 'commercial', 1)
    expect(made.name).toBe('Mixed-Use Block')
    expect(s.treasury).toBe(20 - cost)
    expect(s.hand.map(c => c.id)).toEqual(['road'])
    expect(s.deck.discardPile.at(-1)).toBe(made)
    expect(s.deck.drawPile.length + s.deck.discardPile.length + s.hand.length).toBe(deckBefore - 1)
    expect(game.catalog[made.id]).toBe(made)
    // It builds like any building, with both halves' people and the lean.
    s.hand.push(made); s.treasury = 50
    const pop = calcStatTotal(s, 'population')
    game.actions.playCard(made.id, { x: 11, y: 8 })
    expect(calcStatTotal(s, 'population')).toBeGreaterThanOrEqual(pop + made.stats.population)
  })

  it('refuses without the budget, or with a Road', () => {
    const game = createGame({ ...runGameOptions(), terrain: null })
    const s = game.state
    game.actions.advance()
    game.actions.chooseMandate(s.run.offer[0].id)
    s.hand.splice(0, s.hand.length, card('residential'), card('commercial'), card('road'))
    s.treasury = 0
    expect(() => game.actions.combineCards('residential', 'commercial')).toThrow(/costs/)
    s.treasury = 20
    expect(() => game.actions.combineCards('residential', 'road')).toThrow(/Only buildings/)
  })
})
