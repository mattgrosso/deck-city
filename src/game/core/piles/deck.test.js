import { describe, it, expect } from 'vitest'
import { createDeck, shuffle, draw, discardCards, addToDrawPile, addToDiscardPile } from './deck'

const cards = (...ids) => ids.map(id => ({ id }))

describe('createDeck', () => {
  it('starts with the given cards in the draw pile and an empty discard', () => {
    const deck = createDeck({ id: 'test', cards: cards('a', 'b') })
    expect(deck.drawPile).toEqual(cards('a', 'b'))
    expect(deck.discardPile).toEqual([])
  })
})

describe('shuffle', () => {
  it('is a no-op when rng always picks the last index (identity permutation)', () => {
    const rng = () => 0.999999
    const deck = createDeck({ id: 'test', cards: cards('a', 'b', 'c'), rng })
    shuffle(deck)
    expect(deck.drawPile).toEqual(cards('a', 'b', 'c'))
  })

  it('is deterministic given a fixed rng', () => {
    const rng = () => 0
    const deck = createDeck({ id: 'test', cards: cards('a', 'b', 'c'), rng })
    shuffle(deck)
    expect(deck.drawPile).toEqual(cards('b', 'c', 'a'))
  })
})

describe('draw', () => {
  it('draws from the top of the draw pile', () => {
    const deck = createDeck({ id: 'test', cards: cards('a', 'b') })
    const drawn = draw(deck, 1)
    expect(drawn).toEqual(cards('b'))
    expect(deck.drawPile).toEqual(cards('a'))
  })

  it('reshuffles the discard pile back in once the draw pile is empty', () => {
    const deck = createDeck({ id: 'test', cards: cards('a'), rng: () => 0 })
    discardCards(deck, cards('b', 'c'))
    const drawn = draw(deck, 3)
    expect(drawn).toHaveLength(3)
    expect(deck.drawPile).toEqual([])
    expect(deck.discardPile).toEqual([])
  })

  it('returns fewer than requested if both piles run out', () => {
    const deck = createDeck({ id: 'test', cards: cards('a') })
    const drawn = draw(deck, 5)
    expect(drawn).toEqual(cards('a'))
  })
})

describe('discardCards / addToDrawPile / addToDiscardPile', () => {
  it('append to the respective piles', () => {
    const deck = createDeck({ id: 'test' })
    discardCards(deck, cards('a'))
    addToDrawPile(deck, cards('b'))
    addToDiscardPile(deck, cards('c'))
    expect(deck.discardPile).toEqual(cards('a', 'c'))
    expect(deck.drawPile).toEqual(cards('b'))
  })
})
