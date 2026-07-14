// A generic draw/discard pile pair. Used both for a player's personal deck
// and as the backing source deck for a market row (see row.js) — anything
// that needs "draw N, reshuffle discard back in when empty" reuses this.

/**
 * @param {Object} options
 * @param {string} options.id
 * @param {Object[]} [options.cards] - starting cards, placed in the draw pile
 * @param {() => number} [options.rng] - injectable RNG for deterministic tests, default Math.random
 */
export function createDeck ({ id, cards = [], rng = Math.random } = {}) {
  return {
    id,
    drawPile: [...cards],
    discardPile: [],
    rng
  }
}

/**
 * Fisher-Yates shuffle of the draw pile, in place, using deck.rng.
 * @param {Object} deck
 */
export function shuffle (deck) {
  const pile = deck.drawPile
  for (let i = pile.length - 1; i > 0; i--) {
    const j = Math.floor(deck.rng() * (i + 1))
    ;[pile[i], pile[j]] = [pile[j], pile[i]]
  }
  return deck
}

/**
 * Draws up to `count` cards from the draw pile, reshuffling the discard
 * pile into the draw pile if it runs out mid-draw. Returns fewer than
 * `count` cards if both piles are exhausted.
 * @param {Object} deck
 * @param {number} [count]
 * @returns {Object[]}
 */
export function draw (deck, count = 1) {
  const drawn = []
  for (let i = 0; i < count; i++) {
    if (deck.drawPile.length === 0) {
      if (deck.discardPile.length === 0) break
      deck.drawPile = deck.discardPile
      deck.discardPile = []
      shuffle(deck)
    }
    drawn.push(deck.drawPile.pop())
  }
  return drawn
}

/**
 * @param {Object} deck
 * @param {Object[]} cards
 */
export function discardCards (deck, cards) {
  deck.discardPile.push(...cards)
}

/**
 * Adds cards directly to the draw pile (e.g. shuffling a disaster card into
 * the deck). Does not automatically shuffle — call shuffle() separately if
 * the insertion should be randomized rather than placed on top.
 * @param {Object} deck
 * @param {Object[]} cards
 */
export function addToDrawPile (deck, cards) {
  deck.drawPile.push(...cards)
}

/**
 * Adds cards directly to the discard pile (e.g. an acquired city-row card
 * entering a player's deck to be drawn later).
 * @param {Object} deck
 * @param {Object[]} cards
 */
export function addToDiscardPile (deck, cards) {
  deck.discardPile.push(...cards)
}
