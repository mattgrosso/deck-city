import { describe, it, expect } from 'vitest'
import { createGame, calcStatTotal, calcUpkeep, calcBudget, effectiveCost, marketPrice, POLICIES } from '../index'
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

  it('Property Tax adds to buildings; Tax Reform to the budget', () => {
    const game = newRun()
    const rev = calcStatTotal(game.state, 'revenue')
    adopt(game, 'property-tax')
    expect(calcStatTotal(game.state, 'revenue')).toBe(rev + 1) // one starting house
    const before = calcBudget(game.state)
    adopt(game, 'tax-reform')
    expect(calcBudget(game.state)).toBe(before + 2)
  })

  it('Rent Control and the Infrastructure Bond cut upkeep; Subsidy and Bulk Buying cut prices', () => {
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
  })

  it('Civic Pride slows the drain, Big Government speeds it', () => {
    const drains = (id) => {
      const game = newRun()
      game.actions.chooseMandate(game.state.run.offer[0].id)
      if (id) adopt(game, id)
      let total = 0
      for (let t = 0; t < 10; t++) { game.actions.advance(); for (let i = 0; i < 4; i++) game.actions.advance(); total += game.state.run.lastDrain?.total ?? 0 }
      return total
    }
    expect(drains('civic-pride')).toBeLessThan(drains(null))
    expect(drains('big-government')).toBeGreaterThan(drains(null))
  })
})

describe('earning policies', () => {
  it('a population milestone queues a pick at the end of the turn; picks wait their turn', () => {
    const game = newRun()
    const s = game.state
    game.actions.chooseMandate(s.run.offer[0].id) // the start-of-run pick is still open
    expect(s.run.policyOffer).toHaveLength(3)
    s.builtStructures.push({ instanceId: 'big#9', card: { id: 'big', type: 'building', tags: ['residential'], stats: { population: 205 } }, position: null })
    for (let i = 0; i < 5; i++) game.actions.advance() // to the end of the turn and round
    expect(s.run.milestones).toEqual(expect.arrayContaining([70, 200]))
    expect(s.run.policyQueue.length).toBe(2) // both behind the open start-of-run pick
    game.actions.choosePolicy(s.run.policyOffer[0].id)
    expect(s.run.policyOffer).toHaveLength(3)
    expect(s.run.policyReason).toMatch(/people/)
    expect(s.run.policyQueue.length).toBe(1)
  })

  it('tier II and III goals add a pick to their reward', async () => {
    const { GOAL_CATALOG } = await import('./goalCards')
    for (const g of GOAL_CATALOG) {
      const offers = (g.effects?.onComplete ?? []).some(e => e.type === 'offerPolicy')
      expect(offers).toBe((g.tier ?? 1) >= 2)
    }
  })

  it('one policy is for sale each era; buying it costs budget and adopts it', () => {
    const game = newRun()
    const s = game.state
    game.actions.chooseMandate(s.run.offer[0].id)
    game.actions.choosePolicy(s.run.policyOffer[0].id)
    game.actions.advance() // to the acquire phase
    const sale = s.policyForSale
    expect(sale).toBeTruthy()
    s.treasury = 50
    s.week = 4 // the market's week
    const price = 10 + 4 * s.policies.length
    game.actions.buyPolicy()
    expect(s.treasury).toBe(50 - price)
    expect(s.policies.map(p => p.id)).toContain(sale.id)
    expect(s.policyForSale).toBe(null)
    expect(() => game.actions.buyPolicy()).toThrow(/No policy/)
  })
})
