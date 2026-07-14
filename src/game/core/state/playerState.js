// A player's/city's full state: treasury, personal deck, hand, built
// structures, goals, and the disaster timer. Selectors derive counts from
// the actual cards in play rather than caching them, so there's a single
// source of truth (e.g. status-card counts are read off the piles, not
// tracked in a separate counter that can drift out of sync).

import { createDeck, addToDiscardPile } from '../piles/deck'
import { resolveTrigger } from '../effects/effectRegistry'
import { createCityGrid, placeInstance } from './cityGrid'

/**
 * @param {Object} options
 * @param {Object[]} [options.startingDeckCards]
 * @param {number} [options.treasury]
 * @param {() => number} [options.rng]
 */
export function createPlayerState ({ startingDeckCards = [], treasury = 0, rng } = {}) {
  return {
    treasury,
    deck: createDeck({ id: 'player', cards: startingDeckCards, rng }),
    hand: [],
    builtStructures: [],
    structureSeq: 0,
    cityGrid: createCityGrid(),
    goals: { active: [], completed: [] },
    disasterTimer: { turnsUntilDeadline: 4, headedOff: false },
    turnNumber: 0
  }
}

export function addTreasury (state, amount) {
  state.treasury += amount
}

export function spendTreasury (state, amount) {
  if (amount > state.treasury) {
    throw new Error(`Cannot spend ${amount}, only ${state.treasury} in treasury`)
  }
  state.treasury -= amount
}

/**
 * Pushes `amount` copies of a status card into the discard pile, where it
 * will be drawn and cycled through like any other card.
 * @param {Object} state
 * @param {Object} card - the full status card object
 * @param {number} [amount]
 */
export function addStatusCard (state, card, amount = 1) {
  addToDiscardPile(state.deck, Array(amount).fill(card))
}

function findInstance (state, instanceId) {
  return state.builtStructures.find(instance => instance.instanceId === instanceId)
}

/**
 * Removes up to `amount` copies of a status card from the discard pile,
 * draw pile, and hand (in that order). If opts.requiresSlot is set, the
 * named building instance must have a free consumption slot for each copy
 * removed, and removal stops once its slots are full.
 * @param {Object} state
 * @param {string} cardId
 * @param {number} [amount]
 * @param {{ requiresSlot?: boolean, buildingId?: string }} [opts]
 * @returns {number} the number of copies actually removed
 */
export function removeStatusCard (state, cardId, amount = 1, opts = {}) {
  const instance = opts.requiresSlot ? findInstance(state, opts.buildingId) : undefined
  if (opts.requiresSlot && !instance) return 0

  const piles = [state.deck.discardPile, state.deck.drawPile, state.hand]
  let removed = 0

  for (const pile of piles) {
    while (removed < amount) {
      if (opts.requiresSlot && instance.slots.used >= instance.slots.capacity) return removed
      const index = pile.findIndex(card => card.id === cardId)
      if (index === -1) break
      pile.splice(index, 1)
      removed += 1
      if (opts.requiresSlot) instance.slots.used += 1
    }
    if (removed >= amount) break
  }

  return removed
}

/**
 * Sums stats[statKey] across all built structures. Generic — adding a new
 * stat (e.g. "happiness") needs no changes here.
 * @param {Object} state
 * @param {string} statKey
 */
export function calcStatTotal (state, statKey) {
  return state.builtStructures.reduce(
    (total, instance) => total + (instance.card.stats?.[statKey] ?? 0),
    0
  )
}

/**
 * Counts cards tagged with `tag` across the draw pile, discard pile, and
 * hand.
 * @param {Object} state
 * @param {string} tag
 */
export function countCardsByTag (state, tag) {
  const all = [...state.deck.drawPile, ...state.deck.discardPile, ...state.hand]
  return all.filter(card => card.tags?.includes(tag)).length
}

/**
 * Builds a structure from a played Building card: adds a permanent instance
 * to builtStructures (with its own consumption slots if the card defines
 * any), places it on the city grid if context.position is given, resolves
 * the card's onBuild effects, then returns the card itself to the discard
 * pile so it cycles like any other card. Does not remove the card from
 * hand or charge its cost — callers (e.g. a playCard action) are
 * responsible for that, including validating the position is free.
 * @param {Object} state
 * @param {Object} card
 * @param {Object} [context] - passed through to onBuild effect resolution
 * @param {{x: number, y: number}} [context.position]
 * @returns {Object} the new instance
 */
export function buildStructure (state, card, context = {}) {
  const instance = {
    instanceId: `${card.id}#${state.structureSeq++}`,
    card,
    position: context.position,
    slots: card.slots
      ? { capacity: card.slots.capacity, used: 0 }
      : undefined
  }
  state.builtStructures.push(instance)

  if (context.position) {
    placeInstance(state.cityGrid, context.position.x, context.position.y, instance.instanceId)
  }

  resolveTrigger(card, 'onBuild', { ...context, state })
  addToDiscardPile(state.deck, [card])

  return instance
}

/**
 * Increases a built instance's slot capacity, clamped to its card's
 * maxMultiplier (relative to the card's base capacity).
 * @param {Object} state
 * @param {string} instanceId
 * @param {number} [amount]
 */
export function expandSlots (state, instanceId, amount = 1) {
  const instance = findInstance(state, instanceId)
  if (!instance?.slots || !instance.card.slots?.expandable) return

  const maxCapacity = instance.card.slots.capacity * (instance.card.slots.maxMultiplier ?? 1)
  instance.slots.capacity = Math.min(instance.slots.capacity + amount, maxCapacity)
}

/**
 * Resets consumption-slot usage on a single instance (e.g. at the start of
 * a turn). Slots represent a per-turn consumption budget, not a permanent
 * pool, so something in the turn cycle needs to call this.
 * @param {Object} state
 * @param {string} instanceId
 */
export function resetSlotUsage (state, instanceId) {
  const instance = findInstance(state, instanceId)
  if (instance?.slots) instance.slots.used = 0
}

/** Resets consumption-slot usage on every built instance. */
export function resetAllSlotUsage (state) {
  state.builtStructures.forEach(instance => {
    if (instance.slots) instance.slots.used = 0
  })
}

export function addGoal (state, goalCard) {
  state.goals.active.push(goalCard)
}

/**
 * Moves a goal from active to completed and resolves its onComplete
 * effects.
 * @param {Object} state
 * @param {string} goalId
 * @param {Object} [context]
 */
export function completeGoal (state, goalId, context = {}) {
  const index = state.goals.active.findIndex(goal => goal.id === goalId)
  if (index === -1) return undefined

  const [goal] = state.goals.active.splice(index, 1)
  state.goals.completed.push(goal)
  resolveTrigger(goal, 'onComplete', { ...context, state })
  return goal
}

/**
 * Decrements the disaster timer. Returns true once the deadline has been
 * reached without the threat being headed off — callers decide what
 * happens next (e.g. shuffling a disaster card into the deck).
 * @param {Object} state
 */
export function tickDisasterTimer (state) {
  if (state.disasterTimer.headedOff) return false
  state.disasterTimer.turnsUntilDeadline -= 1
  return state.disasterTimer.turnsUntilDeadline <= 0
}

/**
 * @param {Object} state
 * @param {number} [turns]
 */
export function resetDisasterTimer (state, turns = 4) {
  state.disasterTimer.turnsUntilDeadline = turns
  state.disasterTimer.headedOff = false
}
