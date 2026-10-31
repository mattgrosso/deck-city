import { describe, it, expect } from 'vitest'
import { validateCard, buildCardCatalog } from './cardSchema'
import { STARTER_CARD_CATALOG, STARTER_DECK_CARDS, ROAD, CIVIC_RECYCLE } from './starterCards'

describe('STARTER_CARD_CATALOG', () => {
  it('every card is valid', () => {
    STARTER_CARD_CATALOG.forEach(card => {
      expect(validateCard(card)).toEqual([])
    })
  })

  it('has no duplicate ids', () => {
    const ids = STARTER_CARD_CATALOG.map(card => card.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('STARTER_DECK_CARDS', () => {
  it('is an 8-card starting deck', () => {
    expect(STARTER_DECK_CARDS).toHaveLength(8)
  })

  it('every id resolves against the catalog', () => {
    const catalog = buildCardCatalog(STARTER_CARD_CATALOG)
    STARTER_DECK_CARDS.forEach(id => {
      expect(catalog[id]).toBeDefined()
    })
  })

  it('includes exactly one civic card', () => {
    const civicCount = STARTER_DECK_CARDS.filter(id => id === CIVIC_RECYCLE.id).length
    expect(civicCount).toBe(1)
  })

  it('has no Road cards: the city lays its own streets', () => {
    expect(STARTER_DECK_CARDS.includes(ROAD.id)).toBe(false)
  })
})
