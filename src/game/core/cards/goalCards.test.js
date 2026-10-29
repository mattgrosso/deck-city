import { describe, it, expect } from 'vitest'
import { validateCard, buildCardCatalog } from './cardSchema'
import { evaluateCondition } from '../conditions/conditionRegistry'
import '../conditions/coreConditions'
import { GOAL_CATALOG, GOAL_DECK_CARDS } from './goalCards'

describe('GOAL_CATALOG', () => {
  it('every card is valid', () => {
    GOAL_CATALOG.forEach(card => {
      expect(validateCard(card)).toEqual([])
    })
  })

  it('has no duplicate ids', () => {
    const ids = GOAL_CATALOG.map(card => card.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every goal is a claimable-then-buildable monument: free, needs a street like any building', () => {
    GOAL_CATALOG.forEach(card => {
      expect(card.cost).toBe(0)
      expect(card.skipsRoadRequirement).toBeUndefined()
      expect(card.tags).toContain('monument')
    })
  })

  it('every condition is registered and evaluable against an empty state', () => {
    const state = {
      treasury: 0,
      builtStructures: [],
      deck: { drawPile: [], discardPile: [] },
      hand: [],
      cityGrid: { width: 6, height: 4, cells: [], roads: new Set() }
    }
    GOAL_CATALOG.forEach(card => {
      expect(() => evaluateCondition(card.condition, { state })).not.toThrow()
    })
  })

  it('has a spread of tiers, so the "expires lowest tier every 4 turns" rule has teeth', () => {
    const tiers = new Set(GOAL_CATALOG.map(card => card.tier))
    expect(tiers.size).toBeGreaterThan(1)
  })
})

describe('GOAL_DECK_CARDS', () => {
  it('is one copy of every goal', () => {
    expect(GOAL_DECK_CARDS).toHaveLength(GOAL_CATALOG.length)
    expect(new Set(GOAL_DECK_CARDS).size).toBe(GOAL_CATALOG.length)
  })

  it('every id resolves against the catalog', () => {
    const catalog = buildCardCatalog(GOAL_CATALOG)
    GOAL_DECK_CARDS.forEach(id => expect(catalog[id]).toBeDefined())
  })
})
