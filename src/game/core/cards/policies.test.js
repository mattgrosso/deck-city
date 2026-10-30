import { describe, it, expect } from 'vitest'
import { createGame, calcStatTotal, calcUpkeep, calcBudget, effectiveCost, marketPrice, roadSegmentsOf, POLICIES } from '../index'
import { runGameOptions } from '@/game/runSetup'

// Seeded, so two games compared turn by turn roll the same mood of the town.
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
const newRun = () => {
  const game = createGame({ ...runGameOptions({ rng: seeded(11) }), terrain: null })
  game.actions.advance()
  return game
}
const adopt = (game, id) => {
  game.state.run.policyOffer = [POLICIES.find(p => p.id === id)]
  game.actions.choosePolicy(id)
}

describe('policies', () => {
  it('offers three at the start of a run, none of them rare, and takes one', () => {
    const game = newRun()
    const offer = game.state.run.policyOffer
    expect(offer).toHaveLength(3)
    expect(offer.some(p => p.rare)).toBe(false)
    game.actions.choosePolicy(offer[1].id)
    expect(game.state.policies.map(p => p.id)).toEqual([offer[1].id])
    expect(game.state.run.policyOffer).toEqual([])
    expect(() => game.actions.choosePolicy(offer[0].id)).toThrow(/not on offer/)
  })

  it('every policy is written in plain words and does something the engine reads', () => {
    for (const p of POLICIES) {
      expect(p.text).toMatch(/\.$/)
      expect(Object.keys(p.mods ?? {}).length + (p.rules ?? []).length).toBeGreaterThan(0)
    }
  })

  it('Housing First and Main Street add to buildings; Tax Reform to the budget', () => {
    const game = newRun()
    const pop = calcStatTotal(game.state, 'population')
    const before = calcBudget(game.state)
    adopt(game, 'housing-first')
    expect(calcStatTotal(game.state, 'population')).toBe(pop + 1) // one starting house
    adopt(game, 'tax-reform')
    expect(calcBudget(game.state)).toBe(before + 2)
  })

  it('Rent Control and the Infrastructure Bond cut upkeep; Subsidy, Bulk Buying and the Street Grid cut prices', () => {
    const game = newRun()
    const s = game.state
    s.upkeep = { per: 1, free: 0 }
    expect(calcUpkeep(s)).toBe(3)
    adopt(game, 'rent-control')
    expect(calcUpkeep(s)).toBe(2)
    adopt(game, 'infrastructure-bond')
    expect(calcUpkeep(s)).toBe(0)
    const mill = game.catalog.industrial
    adopt(game, 'industrial-subsidy')
    expect(effectiveCost(s, mill)).toBe(mill.cost - 2)
    const shop = game.catalog.commercial
    adopt(game, 'bulk-buying')
    expect(marketPrice(s, { ...shop, price: 3 })).toBe(2)
    expect(marketPrice(s, { ...shop, price: 1 })).toBe(1)
    adopt(game, 'street-grid')
    expect(roadSegmentsOf(s, game.catalog.road)).toBe(3)
  })

  it('Civic Pride slows the drain, Night Economy speeds it', () => {
    const drains = (id) => {
      const game = newRun()
      game.actions.chooseMandate(game.state.run.offer[0].id)
      if (id) adopt(game, id)
      let total = 0
      for (let t = 0; t < 10; t++) { game.actions.advance(); for (let i = 0; i < 4; i++) game.actions.advance(); total += game.state.run.lastDrain?.total ?? 0 }
      return total
    }
    expect(drains('civic-pride')).toBeLessThan(drains(null))
    expect(drains('night-economy')).toBeGreaterThan(drains(null))
  })
})
