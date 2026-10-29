import { describe, it, expect } from 'vitest'
import { priceList, offTheLine, valueOfBuild, CATALOG, ALL_CARDS } from './priceList'
import { BARGAINS, VALUE, HORIZON, SPEND, valueOfEffect } from './economy'
import { FACILITY_CATALOG } from '../cards/facilityCards'
import { CITY_CARDS } from '../cards/cityCards'
import '../effects/coreEffects'
import { hasEffect } from '../effects/effectRegistry'

// THE ECONOMY (docs/ECONOMY.md; Matt, 2026-10-29: "a unified and consistent
// economy"). Every card is priced in budget; anything off the line must be
// a named BARGAIN with its reason. A new card or a changed number that lands
// off the line FAILS here - fix the price, or name the bargain.
describe('the economy', () => {
  const list = priceList()

  it('nothing is off the line unless it is a named bargain', () => {
    const off = offTheLine(list).map(x => `${x.key} (${x.flag}${x.ratio !== undefined ? `, ratio ${x.ratio}` : ''})`)
    expect(off).toEqual([])
  })

  it('every bargain names something that exists', () => {
    const keys = new Set([...list.plays, ...list.buys, ...list.goals].map(x => x.key))
    Object.keys(BARGAINS).forEach(k => expect(keys.has(k), k).toBe(true))
  })

  it('goal rewards rise with the tier', () => {
    const mean = (t) => { const xs = list.goals.filter(g => g.tier === t).map(g => g.gain); return xs.reduce((a, b) => a + b, 0) / xs.length }
    const tiers = [...new Set(list.goals.map(g => g.tier))].sort()
    for (let i = 1; i < tiers.length; i++) expect(mean(tiers[i]), `tier ${tiers[i]}`).toBeGreaterThan(mean(tiers[i - 1]))
  })

  it('every effect any card uses has a value (a new effect must be priced)', () => {
    for (const card of ALL_CARDS) {
      for (const list of Object.values(card.effects ?? {})) {
        for (const e of list) {
          expect(hasEffect(e.type), `${card.id}: ${e.type}`).toBe(true)
          expect(valueOfEffect(e, CATALOG), `${card.id}: ${e.type} is unpriced`).not.toBe(0)
        }
      }
    }
  })

  it('every market card has its own price, separate from what it costs to build', () => {
    ;[...FACILITY_CATALOG, ...CITY_CARDS].forEach(c => expect(c.price, c.id).toBeGreaterThan(0))
  })

  it('every city card has a cost the economy set, and higher tiers cost more on average', () => {
    CITY_CARDS.forEach(c => expect(c.cost, c.id).not.toBeNull())
    const avg = (t) => { const xs = CITY_CARDS.filter(c => c.type === 'building' && c.tier === t).map(c => c.cost); return xs.reduce((a, b) => a + b, 0) / xs.length }
    expect(avg(2)).toBeGreaterThan(avg(1))
    expect(avg(3)).toBeGreaterThan(avg(2))
  })

  it('the unit holds: a point of revenue is SPEND budget a turn for HORIZON turns', () => {
    expect(VALUE.budget).toBe(1)
    expect(VALUE.revenue).toBeCloseTo(SPEND * HORIZON)
    expect(valueOfBuild({ stats: { revenue: 1 } }).value).toBeCloseTo(VALUE.revenue)
  })
})
