import { describe, it, expect } from 'vitest'
import { validateCard, buildCardCatalog } from './cardSchema'
import { DISASTER_CATALOG, DISASTER_CARDS } from './disasterCards'

describe('DISASTER_CATALOG', () => {
  it('every card is valid', () => {
    DISASTER_CATALOG.forEach(card => {
      expect(validateCard(card)).toEqual([])
    })
  })

  it('has no duplicate ids', () => {
    const ids = DISASTER_CATALOG.map(card => card.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every disaster bites via onDraw, not onBuild or onTurnStart', () => {
    DISASTER_CATALOG.forEach(card => {
      expect(card.effects.onDraw).toBeDefined()
      expect(card.effects.onBuild).toBeUndefined()
      expect(card.effects.onTurnStart).toBeUndefined()
    })
  })
})

describe('DISASTER_CARDS', () => {
  it('every id resolves against the catalog', () => {
    const catalog = buildCardCatalog(DISASTER_CATALOG)
    DISASTER_CARDS.forEach(id => expect(catalog[id]).toBeDefined())
  })
})
