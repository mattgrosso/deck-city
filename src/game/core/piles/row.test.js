import { describe, it, expect } from 'vitest'
import { createDeck } from './deck'
import { createRow, fillRow, expireOldest, expireLowestValue, acquireFromRow, tickTimers } from './row'

const cards = (...ids) => ids.map(id => ({ id }))

describe('createRow / fillRow', () => {
  it('fills up to size from the source deck, oldest-drawn first', () => {
    const sourceDeck = createDeck({ id: 'city', cards: cards('a', 'b', 'c', 'd', 'e') })
    const row = createRow({ sourceDeck, size: 4 })
    expect(row.cards).toHaveLength(4)
    expect(sourceDeck.drawPile).toEqual(cards('a'))
  })

  it('does not overfill beyond size', () => {
    const sourceDeck = createDeck({ id: 'city', cards: cards('a', 'b') })
    const row = createRow({ sourceDeck, size: 4 })
    expect(row.cards).toHaveLength(2)
    fillRow(row)
    expect(row.cards).toHaveLength(2)
  })
})

describe('expireOldest', () => {
  it('sends the oldest card to the source deck discard pile and backfills', () => {
    const sourceDeck = createDeck({ id: 'city', cards: cards('a', 'b', 'c', 'd', 'e') })
    const row = createRow({ sourceDeck, size: 4 })
    const oldest = row.cards[0]

    const expired = expireOldest(row)

    expect(expired).toBe(oldest)
    expect(row.cards).toHaveLength(4)
    expect(row.cards).not.toContain(oldest)
    expect(sourceDeck.discardPile).toEqual([oldest])
  })
})

describe('expireLowestValue', () => {
  it('expires whichever visible card has the lowest value and backfills', () => {
    const sourceDeck = createDeck({ id: 'goal', cards: cards('a') })
    const row = { sourceDeck, size: 3, cards: [{ id: 'x', tier: 2 }, { id: 'y', tier: 1 }, { id: 'z', tier: 3 }] }

    const expired = expireLowestValue(row, card => card.tier)

    expect(expired.id).toBe('y')
    expect(row.cards.map(card => card.id)).toEqual(expect.arrayContaining(['x', 'z', 'a']))
    expect(row.cards).toHaveLength(3)
    expect(sourceDeck.discardPile.map(card => card.id)).toEqual(['y'])
  })

  it('breaks ties by picking whichever comes first in the row', () => {
    const sourceDeck = createDeck({ id: 'goal', cards: [] })
    const row = { sourceDeck, size: 2, cards: [{ id: 'first', tier: 1 }, { id: 'second', tier: 1 }] }

    const expired = expireLowestValue(row, card => card.tier)

    expect(expired.id).toBe('first')
  })

  it('is a no-op on an empty row', () => {
    const sourceDeck = createDeck({ id: 'goal', cards: [] })
    const row = { sourceDeck, size: 3, cards: [] }

    expect(expireLowestValue(row, card => card.tier)).toBeUndefined()
    expect(row.cards).toEqual([])
  })
})

describe('acquireFromRow', () => {
  it('removes a card by id and backfills from the source deck', () => {
    const sourceDeck = createDeck({ id: 'city', cards: cards('a', 'b', 'c', 'd', 'e') })
    const row = createRow({ sourceDeck, size: 4 })
    const target = row.cards[2]

    const acquired = acquireFromRow(row, target.id)

    expect(acquired).toBe(target)
    expect(row.cards).toHaveLength(4)
    expect(row.cards).not.toContain(target)
  })

  it('returns undefined if the card is not in the row', () => {
    const sourceDeck = createDeck({ id: 'city', cards: cards('a', 'b', 'c', 'd') })
    const row = createRow({ sourceDeck, size: 4 })
    expect(acquireFromRow(row, 'not-there')).toBeUndefined()
  })
})

describe('tickTimers', () => {
  it('counts every timed card down a turn, expires the ones at zero and backfills with fresh clocks', () => {
    const sourceDeck = createDeck({ id: 'goal', cards: [{ id: 'a', tier: 1 }, { id: 'b', tier: 3 }, { id: 'c', tier: 2 }] })
    const row = createRow({ sourceDeck, size: 2, timerFor: (card) => card.tier })
    expect(row.timers).toEqual([2, 3]) // c (tier 2) and b (tier 3) drawn from the end
    expect(tickTimers(row)).toEqual([])
    expect(row.timers).toEqual([1, 2])
    const expired = tickTimers(row)
    expect(expired.map(c => c.id)).toEqual(['c'])
    expect(row.cards.map(c => c.id)).toEqual(['b', 'a'])
    expect(row.timers).toEqual([1, 1])
    expect(sourceDeck.discardPile.map(c => c.id)).toEqual(['c'])
  })

  it('keeps timers lined up with cards through an acquire', () => {
    const sourceDeck = createDeck({ id: 'goal', cards: [{ id: 'a', tier: 1 }, { id: 'b', tier: 3 }, { id: 'c', tier: 2 }] })
    const row = createRow({ sourceDeck, size: 2, timerFor: (card) => card.tier })
    acquireFromRow(row, 'c')
    expect(row.cards.map(c => c.id)).toEqual(['b', 'a'])
    expect(row.timers).toEqual([3, 1])
  })
})
