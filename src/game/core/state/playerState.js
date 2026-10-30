// A player's/city's full state: treasury, personal deck, hand, built
// structures, goals, and the disaster timer. Selectors derive counts from
// the actual cards in play rather than caching them, so there's a single
// source of truth (e.g. status-card counts are read off the piles, not
// tracked in a separate counter that can drift out of sync).

import { createDeck, addToDiscardPile } from '../piles/deck'
import { resolveTrigger } from '../effects/effectRegistry'
import { createCityGrid, placeInstance, addRoadEdge, seedStartingRoads, instanceAt } from './cityGrid'
import { WATERFRONT, touchesWater } from './terrain'

/**
 * @param {Object} options
 * @param {Object[]} [options.startingDeckCards]
 * @param {number} [options.treasury]
 * @param {() => number} [options.rng]
 */
export function createPlayerState ({ startingDeckCards = [], treasury = 0, rng, gridSize, startingRoadEdges } = {}) {
  const cityGrid = createCityGrid(gridSize)
  seedStartingRoads(cityGrid, startingRoadEdges)

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
    // Every fourth turn a disaster strikes, harder each time: the Nth strike
    // shuffles N disaster cards in, less one per Fire Station standing
    // (`blocksDisasters`). `headedOff` is kept for old saves; nothing sets it.
    disasterTimer: { turnsUntilDeadline: 4, headedOff: false, strikes: 0 },
    // One goal may be claimed a turn (Matt: "I was able to buy like 5 of the goals").
    goalsClaimedThisTurn: 0,
    // Buys left this turn at the city row. Reset to the game's buysPerTurn
    // (1) every draw; cards with gainBuys add more. Matt: "I can buy way
    // too many cards in a turn... a limit of one buy and then cards that
    // give additional buys."
    buys: 1,
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
 * One building's stats with its neighbours counted in: its card's base
 * stats plus every adjacency bonus on its card (card.adjacency.statBonus:
 * { stat, amount, targetTag } = `amount` of `stat` for EACH orthogonal
 * neighbour tagged `targetTag`; amounts may be negative). No stat drops
 * below zero - a bad spot hurts, it never subtracts from the rest of the
 * city. Matt: "I really want to add a layer of decision around what gets
 * built next to what."
 * @returns {{ base: Object, bonus: Object, total: Object, reasons: {stat: string, amount: number, tag: string, count: number}[] }}
 */
export function instanceStats (state, instance) {
  const base = { ...(instance.card.stats ?? {}) }
  const bonus = {}
  const reasons = []
  const rules = instance.card.adjacency?.statBonus ?? []
  if (rules.length) {
    const neighbors = getAdjacentInstances(state, instance.instanceId)
    for (const rule of rules) {
      // scope 'city': every matching building anywhere (not this one), not just next door.
      const pool = rule.scope === 'city' ? state.builtStructures.filter(o => o !== instance) : neighbors
      let count = pool.filter(n => n.card.tags?.includes(rule.targetTag)).length
      if (rule.per) count = Math.floor(count / rule.per)
      if (rule.max) count = Math.min(count, rule.max)
      if (!count) continue
      bonus[rule.stat] = (bonus[rule.stat] ?? 0) + count * rule.amount
      reasons.push({ stat: rule.stat, amount: count * rule.amount, tag: rule.targetTag, count, scope: rule.scope ?? 'near' })
    }
  }
  // Waterfront: a home or shop beside water, once however much it touches.
  if (instance.position && touchesWater(state.cityGrid, instance.position.x, instance.position.y)) {
    for (const w of WATERFRONT) {
      if (!instance.card.tags?.includes(w.tag)) continue
      bonus[w.stat] = (bonus[w.stat] ?? 0) + w.amount
      reasons.push({ stat: w.stat, amount: w.amount, tag: 'water', count: 1, scope: 'near' })
    }
  }
  const total = {}
  for (const key of new Set([...Object.keys(base), ...Object.keys(bonus)])) {
    total[key] = Math.max(0, (base[key] ?? 0) + (bonus[key] ?? 0))
  }
  return { base, bonus, total, reasons }
}

/**
 * Sums a stat across every built structure, neighbours counted in (see
 * instanceStats). Adding a new adjacency-aware card is card data, not code.
 * @param {Object} state
 * @param {string} statKey
 */
export function calcStatTotal (state, statKey) {
  return state.builtStructures.reduce((total, instance) => total + (instanceStats(state, instance).total[statKey] ?? 0), 0)
}

/**
 * What placing `card` at `position` would do, without doing it: the new
 * building's own stats there, and how every neighbour's stats would change.
 * For the aiming preview. Temporarily stands the building in the grid and
 * always takes it back out.
 * @returns {{ own: Object, ownReasons: Object[], neighbours: {instanceId: string, position: Object, name: string, delta: Object}[], delta: Object }}
 */
export function previewPlacement (state, card, position) {
  const before = new Map(state.builtStructures.map(i => [i.instanceId, instanceStats(state, i).total]))
  const totalsBefore = sumTotals([...before.values()])
  const probe = { instanceId: '__preview__', card, position }
  const index = position.y * state.cityGrid.width + position.x
  const prevCell = state.cityGrid.cells[index]
  state.builtStructures.push(probe)
  state.cityGrid.cells[index] = probe.instanceId
  try {
    const own = instanceStats(state, probe)
    const neighbours = []
    const totalsAfter = []
    for (const inst of state.builtStructures) {
      const after = instanceStats(state, inst).total
      totalsAfter.push(after)
      if (inst === probe) continue
      const was = before.get(inst.instanceId) ?? {}
      const delta = diffStats(was, after)
      if (Object.keys(delta).length) neighbours.push({ instanceId: inst.instanceId, position: inst.position, name: inst.card.name, delta })
    }
    return { own: own.total, ownReasons: own.reasons, neighbours, delta: diffStats(totalsBefore, sumTotals(totalsAfter)) }
  } finally {
    state.builtStructures.pop()
    state.cityGrid.cells[index] = prevCell
  }
}

function sumTotals (list) {
  const out = {}
  for (const t of list) for (const [k, v] of Object.entries(t)) out[k] = (out[k] ?? 0) + v
  return out
}

function diffStats (was, now) {
  const out = {}
  for (const key of new Set([...Object.keys(was), ...Object.keys(now)])) {
    const d = (now[key] ?? 0) - (was[key] ?? 0)
    if (d) out[key] = d
  }
  return out
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

  resolveTrigger(card, 'onBuild', { ...context, state, instanceId: instance.instanceId })
  // Neighbours react to what was built beside them (card.effects.onNeighborBuilt).
  if (context.position) {
    for (const neighbor of getAdjacentInstances(state, instance.instanceId)) {
      resolveTrigger(neighbor.card, 'onNeighborBuilt', { ...context, state, instanceId: neighbor.instanceId, neighbor: instance })
    }
  }
  addToDiscardPile(state.deck, [card])

  return instance
}

/** Sum of a numeric passive property across every standing building. */
export function sumPassive (state, key) {
  return state.builtStructures.reduce((n, i) => n + (typeof i.card[key] === 'number' ? i.card[key] : (i.card[key] ? 1 : 0)), 0)
}

/**
 * What a card costs to play right now: its cost, less every standing
 * building's discount that matches one of its tags (`discount: { tag,
 * amount }` or a list of them), never below zero.
 */
export function effectiveCost (state, card) {
  // Each era raises what buildings cost to build (turn/run.js sets costRise); Roads stay cheap.
  const rise = card.type === 'building' && !card.placesRoad ? (state.costRise ?? 0) : 0
  const base = (card.cost ?? 0) + rise
  let off = 0
  for (const inst of state.builtStructures) {
    const list = Array.isArray(inst.card.discount) ? inst.card.discount : (inst.card.discount ? [inst.card.discount] : [])
    for (const d of list) if (card.tags?.includes(d.tag)) off += d.amount
  }
  return Math.max(0, base - off)
}

/**
 * Upkeep (Matt, 2026-10-29: "I never ran out of money"): every building
 * past the first `free` costs `per` budget a turn to run. A combined
 * building is one building, so combining also saves upkeep. Monuments
 * (claimed goals) are free. `state.upkeep` = { per, free }; none by default.
 */
export function calcUpkeep (state) {
  const u = state.upkeep
  if (!u?.per) return 0
  const count = state.builtStructures.filter(i => i.card.type === 'building').length
  return Math.max(0, count - (u.free ?? 0)) * u.per
}

/** Next turn's budget before anything carried over: revenue less upkeep, never below zero. */
export function calcBudget (state, baseRevenue = 0) {
  return Math.max(0, calcStatTotal(state, 'revenue') + baseRevenue - calcUpkeep(state))
}

/** Status kinds a facility clears: `clears` is one tag or a list. */
export function clearsOf (card) {
  return Array.isArray(card.clears) ? card.clears : (card.clears ? [card.clears] : [])
}

/**
 * Stands a building in the city at game start: an instance and a grid
 * cell, nothing else - no onBuild effects (a starting house brings no
 * Crime), no card into the deck. Matt: "at the start of the game, you
 * start with a few buildings already, and those add up to the resources
 * that you start with."
 */
export function seedStructure (state, card, position) {
  const instance = {
    instanceId: `${card.id}#${state.structureSeq++}`,
    card,
    position,
    slots: card.slots ? { capacity: card.slots.capacity, used: 0 } : undefined
  }
  state.builtStructures.push(instance)
  placeInstance(state.cityGrid, position.x, position.y, instance.instanceId)
  return instance
}

/** How many standing buildings block disasters (Fire Stations). */
export function countDisasterBlockers (state) {
  return sumPassive(state, 'blocksDisasters')
}

/**
 * Trashes one status card from the hand into a facility that clears that
 * kind (`card.clears`, e.g. 'crime') and has a free slot this turn. The
 * card leaves the game for good. Returns the instance that took it.
 * Matt: "I've never actually put a crime card into it... it'd be more fun
 * if I was doing it myself."
 */
export function clearStatusCard (state, cardId) {
  const index = state.hand.findIndex(c => c.id === cardId)
  if (index === -1) throw new Error(`Card "${cardId}" is not in hand`)
  const card = state.hand[index]
  if (card.type !== 'status') throw new Error(`${card.name} is not a status card`)
  const tag = card.id
  const instance = state.builtStructures.find(i => clearsOf(i.card).includes(tag) && i.slots && i.slots.used < i.slots.capacity)
  if (!instance) throw new Error(`No free slot for ${card.name}`)
  state.hand.splice(index, 1)
  instance.slots.used += 1
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
  if (context.intoDeck !== false) addToDiscardPile(state.deck, [card])
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
