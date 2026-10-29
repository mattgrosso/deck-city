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
/**
 * `timerFor(card)` gives a row per-card clocks: each card counts down a
 * turn at a time (tickTimers) and expires at zero. The goal row uses it so
 * every goal shows how long it has left (Matt: "a timer on each of them to
 * make it clear what's at stake"). Without it, `timers` stays empty.
 */
export function createRow ({ sourceDeck, size = 4, timerFor = null }) {
  const row = { sourceDeck, size, cards: [], timers: [], timerFor }
  fillRow(row)
  return row
}

const dropAt = (row, index) => {
  const [card] = row.cards.splice(index, 1)
  if (row.timerFor) row.timers.splice(index, 1)
  return card
}

/** One turn passes: every timed card counts down; the ones at zero expire and are backfilled. */
export function tickTimers (row) {
  if (!row.timerFor) return []
  const expired = []
  for (let i = row.cards.length - 1; i >= 0; i--) {
    row.timers[i] -= 1
    if (row.timers[i] <= 0) expired.push(dropAt(row, i))
  }
  if (expired.length) discardCards(row.sourceDeck, expired)
  fillRow(row)
  return expired.reverse()
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
    const drawn = draw(row.sourceDeck, needed)
    row.cards.push(...drawn)
    if (row.timerFor) row.timers.push(...drawn.map(card => row.timerFor(card)))
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
  const expired = row.cards.length ? dropAt(row, 0) : undefined
  if (expired) discardCards(row.sourceDeck, [expired])
  fillRow(row)
  return expired
}

/**
 * Expires whichever visible card has the lowest value under valueFn (sends
 * it to the source deck's discard pile) and backfills the row. Ties resolve
 * to whichever comes first in row.cards. Used for the goal row's "every 4
 * turns, the lowest-tier unclaimed goal expires" rule (see
 * turn/phases.js) - a value-based variant of expireOldest's
 * always-the-oldest rule, kept generic here rather than goal-specific since
 * the row itself has no idea what a "tier" is.
 * @param {Object} row
 * @param {(card: Object) => number} valueFn
 * @returns {Object|undefined} the expired card, if any
 */
export function expireLowestValue (row, valueFn) {
  if (!row.cards.length) return undefined

  let lowestIndex = 0
  for (let i = 1; i < row.cards.length; i++) {
    if (valueFn(row.cards[i]) < valueFn(row.cards[lowestIndex])) lowestIndex = i
  }

  const expired = dropAt(row, lowestIndex)
  discardCards(row.sourceDeck, [expired])
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
  const acquired = dropAt(row, index)
  fillRow(row)
  return acquired
}
