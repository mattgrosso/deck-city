// The city-row market: a small number of cards (default 4) revealed at
// once, drawn from a source deck. The oldest visible card "falls off" at
// the end of a turn and a replacement is drawn to backfill. The source
// deck is a regular Deck (see deck.js), so expired/depleted cards reshuffle
// the same way a player's own deck does — no separate "expired" concept.

import { draw, discardCards } from './deck'

/**
 * @param {Object} options
 * @param {Object} options.sourceDeck - a Deck (see createDeck)
 * @param {number} [options.size]
 */
export function createRow ({ sourceDeck, size = 4 }) {
  const row = { sourceDeck, size, cards: [] }
  fillRow(row)
  return row
}

/**
 * Draws from the source deck until the row is at capacity. cards[0] is the
 * oldest visible card (first in, first to expire); new reveals are pushed
 * to the end.
 * @param {Object} row
 */
export function fillRow (row) {
  const needed = row.size - row.cards.length
  if (needed > 0) {
    row.cards.push(...draw(row.sourceDeck, needed))
  }
  return row
}

/**
 * Expires the oldest visible card (sends it to the source deck's discard
 * pile) and backfills the row.
 * @param {Object} row
 * @returns {Object|undefined} the expired card, if any
 */
export function expireOldest (row) {
  const [expired] = row.cards.splice(0, 1)
  if (expired) discardCards(row.sourceDeck, [expired])
  fillRow(row)
  return expired
}

/**
 * Removes a card from the row by id (e.g. a player acquiring it). The
 * caller is responsible for putting the returned card wherever it belongs
 * (typically the acquiring player's deck discard pile). Backfills the row.
 * @param {Object} row
 * @param {string} cardId
 * @returns {Object|undefined} the acquired card, if found
 */
export function acquireFromRow (row, cardId) {
  const index = row.cards.findIndex(card => card.id === cardId)
  if (index === -1) return undefined
  const [acquired] = row.cards.splice(index, 1)
  fillRow(row)
  return acquired
}
