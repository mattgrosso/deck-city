import { describe, it, expect } from 'vitest'
import { CARD_TYPES, validateCard, buildCardCatalog } from './cardSchema'
import { EXAMPLE_CARDS, ROAD, CRIME } from './exampleCards'

describe('validateCard', () => {
  it('accepts every example card', () => {
    EXAMPLE_CARDS.forEach(card => {
      expect(validateCard(card)).toEqual([])
    })
  })

  it('flags a missing id', () => {
    const errors = validateCard({ type: CARD_TYPES.BUILDING, name: 'Nameless' })
    expect(errors).toContain('missing id')
  })

  it('flags an unknown type', () => {
    const errors = validateCard({ id: 'x', name: 'X', type: 'not-a-type' })
    expect(errors).toContain('unknown type "not-a-type"')
  })

  it('flags a non-array effects trigger', () => {
    const errors = validateCard({
      id: 'x', name: 'X', type: CARD_TYPES.BUILDING, effects: { onBuild: { type: 'gainTreasury' } }
    })
    expect(errors).toContain('effects.onBuild must be an array of effect descriptors')
  })

  it('flags an effect descriptor missing a type', () => {
    const errors = validateCard({
      id: 'x', name: 'X', type: CARD_TYPES.BUILDING, effects: { onBuild: [{ amount: 1 }] }
    })
    expect(errors).toContain('effects.onBuild[0] is missing a type')
  })

  it('flags slots without a numeric capacity', () => {
    const errors = validateCard({
      id: 'x', name: 'X', type: CARD_TYPES.BUILDING, slots: {}
    })
    expect(errors).toContain('slots.capacity must be a number')
  })
})

describe('buildCardCatalog', () => {
  it('indexes cards by id', () => {
    const catalog = buildCardCatalog([ROAD, CRIME])
    expect(catalog.road).toBe(ROAD)
    expect(catalog.crime).toBe(CRIME)
  })
})
