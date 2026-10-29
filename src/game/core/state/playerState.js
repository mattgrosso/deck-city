// A player's/city's full state: treasury, personal deck, hand, built
// structures, goals, and the disaster timer. Selectors derive counts from
// the actual cards in play rather than caching them, so there's a single
// source of truth (e.g. status-card counts are read off the piles, not
// tracked in a separate counter that can drift out of sync).

import { createDeck, addToDiscardPile } from '../piles/deck'
import { resolveTrigger } from '../effects/effectRegistry'
import { createCityGrid, placeInstance, addRoadEdge, seedStartingRoads, instanceAt } from './cityGrid'

/**
 * @param {Object} options
 * @param {Object[]} [options.startingDeckCards]
 * @param {number} [options.treasury]
 * @param {() => number} [options.rng]
 */
export function createPlayerState ({ startingDeckCards = [], treasury = 0, rng } = {}) {
  const cityGrid = createCityGrid()
  seedStartingRoads(cityGrid)

  return {
    treasury,
    // A permanent budget escape valve — see raiseTreasuryRolloverCap. Zero
    // by default: the base rule is a hard reset to current production every
    // turn (see turn/phases.js's 'draw' phase), no accumulation.
    treasuryRolloverCap: 0,
    deck: createDeck({ id: 'player', cards: startingDeckCards, rng }),
    hand: [],
    builtStructures: [],
    structureSeq: 0,
    cityGrid,
    goals: { active: [], completed: [] },
    disasterTimer: { turnsUntilDeadline: 4, headedOff: false },
    turnNumber: 0,
    // 'playing' | 'won' | 'lost' — set by turn/phases.js's 'endOfTurn'
    // phase. Player actions (build/acquire/claim) are gated on this once
    // it leaves 'playing'; phase advancement itself is not, so a finished
    // game doesn't get stuck mid-cycle.
    gameStatus: 'playing'
  }
}

/**
 * Raises the permanent treasury rollover cap — the "escape valve" for the
 * hard-reset budget rule (see the 'draw' phase in turn/phases.js): up to
 * this much of last turn's leftover treasury carries forward instead of
 * being wiped. Earned via a goal's onComplete effect (see
 * cards/goalCards.js's City Bank), never automatic. Clamped to only ever
 * increase — completing a lesser version of the same goal twice (not
 * currently possible, but cheap to guard) shouldn't lower it.
 * @param {Object} state
 * @param {number} amount
 */
export function raiseTreasuryRolloverCap (state, amount) {
  state.treasuryRolloverCap = Math.max(state.treasuryRolloverCap, amount)
}

/**
 * Permanently freezes the disaster timer (see tickDisasterTimer) — the
 * counterplay a Fire Station buys. Unlike resetDisasterTimer, this doesn't
 * refill turnsUntilDeadline; it just stops it ticking down at all.
 * @param {Object} state
 */
export function headOffDisaster (state) {
  state.disasterTimer.headedOff = true
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
 * The (up to 4) built instances orthogonally adjacent to a given instance's
 * grid cell — the basis for adjacency effects (see cards/facilityCards.js's
 * Park: a revenue bonus to neighbors and status generation both key off
 * this). Instances with no position (shouldn't happen for anything actually
 * built via buildStructure, but cheap to guard) have no neighbors.
 * @param {Object} state
 * @param {string} instanceId
 * @returns {Object[]}
 */
export function getAdjacentInstances (state, instanceId) {
  const instance = findInstance(state, instanceId)
  if (!instance?.position) return []

  const { x, y } = instance.position
  return [[0, -1], [0, 1], [-1, 0], [1, 0]]
    .map(([dx, dy]) => instanceAt(state.cityGrid, x + dx, y + dy))
    .filter(Boolean)
    .map(neighborId => findInstance(state, neighborId))
    .filter(Boolean)
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
 * Sums stats[statKey] across all built structures, plus any adjacency stat
 * bonuses currently in effect (e.g. Park's "+1 revenue to adjacent
 * Residential" - see cards/facilityCards.js). Generic — adding a new base
 * stat needs no changes here; adding a new adjacency-granting card is just
 * card data (card.adjacency.statBonus), not new engine code.
 * @param {Object} state
 * @param {string} statKey
 */
export function calcStatTotal (state, statKey) {
  const base = state.builtStructures.reduce(
    (total, instance) => total + (instance.card.stats?.[statKey] ?? 0),
    0
  )

  const adjacencyBonus = state.builtStructures.reduce((total, instance) => {
    const bonuses = instance.card.adjacency?.statBonus?.filter(bonus => bonus.stat === statKey)
    if (!bonuses?.length) return total

    const neighbors = getAdjacentInstances(state, instance.instanceId)
    return total + bonuses.reduce((sum, bonus) => {
      const matches = neighbors.filter(neighbor => neighbor.card.tags?.includes(bonus.targetTag)).length
      return sum + matches * bonus.amount
    }, 0)
  }, 0)

  return base + adjacencyBonus
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
 * Places a road card: paints ONE edge (context.edge, an edge key - see
 * cityGrid.js) onto the city grid, resolves the card's onBuild effects (if
 * any), then returns the card itself to the discard pile. Unlike
 * buildStructure(), this never creates a builtStructures instance - a
 * road never occupies a cell. Does not remove the card from hand or
 * charge its cost - callers are responsible for that.
 * @param {Object} state
 * @param {Object} card
 * @param {Object} [context] - passed through to onBuild effect resolution
 * @param {string} context.edge
 */
export function placeRoad (state, card, context = {}) {
  addRoadEdge(state.cityGrid, context.edge)
  resolveTrigger(card, 'onBuild', { ...context, state })
  addToDiscardPile(state.deck, [card])
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
