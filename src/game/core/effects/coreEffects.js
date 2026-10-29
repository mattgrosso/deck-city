// The starter effect vocabulary. Each handler is a thin wrapper over a
// playerState mutator — this file is the only place that needs to change
// to add a new effect type; nothing else in the engine knows these names.
// Importing this module registers its effects as a side effect, so
// consumers just need `import './coreEffects'` (or import it via
// game/core/index.js) once before resolving any card effects.

import { registerEffect } from './effectRegistry'
import {
  addTreasury,
  spendTreasury,
  addStatusCard,
  removeStatusCard,
  expandSlots,
  getAdjacentInstances,
  headOffDisaster,
  raiseTreasuryRolloverCap,
  countCardsByTag
} from '../state/playerState'
import { draw, addToDiscardPile } from '../piles/deck'

registerEffect('gainTreasury', (effect, { state, log }) => {
  addTreasury(state, effect.amount)
  log?.push(`+${effect.amount} budget.`)
})

registerEffect('spendTreasury', (effect, { state, log }) => {
  spendTreasury(state, effect.amount)
  log?.push(`Lost ${effect.amount} budget.`)
})

/**
 * effect: { type: 'gainStatus', card: <status card id>, amount? }
 * Looks the id up in context.catalog since effect descriptors reference
 * other cards by id, not by embedding the full card object.
 */
registerEffect('gainStatus', (effect, { state, catalog, log }) => {
  const card = catalog[effect.card]
  addStatusCard(state, card, effect.amount ?? 1)
  log?.push(`+${effect.amount ?? 1} ${card.name} card${(effect.amount ?? 1) === 1 ? '' : 's'} in your deck.`)
})

/**
 * effect: { type: 'consumeStatus', card: <status card id>, amount?,
 *           requiresSlot?, buildingId? }. buildingId may be the literal
 * string 'self', which resolves to context.instanceId — this is how a
 * card's own effects refer to "whichever instance of me triggered this"
 * without knowing its instance id up front.
 */
registerEffect('consumeStatus', (effect, { state, catalog, log, instanceId }) => {
  const card = catalog[effect.card]
  const buildingId = effect.buildingId === 'self' ? instanceId : effect.buildingId
  const removed = removeStatusCard(state, card.id, effect.amount ?? 1, {
    requiresSlot: effect.requiresSlot,
    buildingId
  })
  log?.push(`${removed} ${card.name} card${removed === 1 ? '' : 's'} cleared.`)
  return removed
})

registerEffect('drawCards', (effect, { state }) => {
  const drawn = draw(state.deck, effect.amount ?? 1)
  state.hand.push(...drawn)
  return drawn
})

/**
 * effect: { type: 'discardCards' }, resolved with context.cardIds set to
 * an explicit list of card ids to discard from hand — which cards is a
 * player choice, not part of the card data, so it travels via context
 * rather than the effect descriptor.
 */
registerEffect('discardCards', (effect, { state, cardIds = [] }) => {
  const discarded = []
  cardIds.forEach(cardId => {
    const index = state.hand.findIndex(card => card.id === cardId)
    if (index !== -1) discarded.push(state.hand.splice(index, 1)[0])
  })
  state.deck.discardPile.push(...discarded)
  return discarded
})

/**
 * effect: { type: 'expandSlots', buildingId, amount? }
 */
registerEffect('expandSlots', (effect, { state }) => {
  expandSlots(state, effect.buildingId, effect.amount ?? 1)
})

/**
 * effect: { type: 'gainStatusPerAdjacent', card: <status card id>,
 *           targetTag }. Resolved on 'onTurnStart' with context.instanceId
 * set to the triggering instance (same convention as consumeStatus's
 * buildingId: 'self') - counts orthogonal neighbors tagged targetTag and
 * grants that many copies of the status card. See cards/facilityCards.js's
 * Park: "+1 Crime per adjacent Residential".
 */
registerEffect('gainStatusPerAdjacent', (effect, { state, catalog, log, instanceId }) => {
  const neighbors = getAdjacentInstances(state, instanceId)
  const count = neighbors.filter(neighbor => neighbor.card.tags?.includes(effect.targetTag)).length
  if (count === 0) return 0

  const card = catalog[effect.card]
  addStatusCard(state, card, count)
  log?.push(`+${count} ${card.name} from a Park beside ${count} house${count === 1 ? '' : 's'}.`)
  return count
})

/**
 * effect: { type: 'headOffDisaster' } - see playerState.js's
 * headOffDisaster. Used by Fire Station's onBuild.
 */
registerEffect('headOffDisaster', (effect, { state, log }) => {
  headOffDisaster(state)
  log?.push('Disaster risk headed off')
})

/**
 * effect: { type: 'raiseTreasuryRolloverCap', amount } - see playerState.js's
 * raiseTreasuryRolloverCap. Used by the City Bank goal's onComplete.
 */
registerEffect('raiseTreasuryRolloverCap', (effect, { state, log }) => {
  raiseTreasuryRolloverCap(state, effect.amount)
  log?.push(`You may now keep up to ${effect.amount} unspent budget between turns.`)
})

/** More city-row purchases this turn (state.buys resets to buysPerTurn every draw). */
registerEffect('gainBuys', (effect, { state, log }) => {
  state.buys = (state.buys ?? 0) + (effect.amount ?? 1)
  log?.push(`+${effect.amount ?? 1} buy this turn.`)
})

// ---- the city-builder vocabulary (2026-10-29: "much more interesting
// building and card abilities so that we can find combinations")

const neighborsOf = (state, instanceId) => (instanceId ? getAdjacentInstances(state, instanceId) : [])
const hasTag = (inst, tag) => inst.card.tags?.includes(tag)

/** +amount budget per neighbour tagged targetTag. */
registerEffect('gainTreasuryPerAdjacent', (effect, { state, log, instanceId }) => {
  const n = neighborsOf(state, instanceId).filter(i => hasTag(i, effect.targetTag)).length * (effect.amount ?? 1)
  if (n) { state.treasury += n; log?.push(`+${n} budget from neighbours.`) }
})

/** +amount budget per `per` buildings tagged `tag` anywhere in the city. */
registerEffect('gainTreasuryPerCount', (effect, { state, log }) => {
  const count = state.builtStructures.filter(i => hasTag(i, effect.tag)).length
  const n = Math.floor(count / (effect.per ?? 1)) * (effect.amount ?? 1)
  if (n) { state.treasury += n; log?.push(`+${n} budget (${count} ${effect.tag}).`) }
})

/** +amount budget per status card of a kind in your deck, up to max. */
registerEffect('gainTreasuryPerStatus', (effect, { state, log }) => {
  const n = Math.min(countCardsByTag(state, effect.tag), effect.max ?? 99) * (effect.amount ?? 1)
  if (n) { state.treasury += n; log?.push(`+${n} budget from ${effect.tag}.`) }
})

/** Removes up to `amount` status cards of any kind (discard pile first, then draw pile). */
registerEffect('clearAnyStatus', (effect, { state, log }) => {
  let left = effect.amount ?? 1
  let removed = 0
  for (const pile of [state.deck.discardPile, state.deck.drawPile]) {
    for (let i = pile.length - 1; i >= 0 && left > 0; i--) {
      if (pile[i].type === 'status' || (effect.disasters && pile[i].type === 'disaster')) { pile.splice(i, 1); left--; removed++ }
    }
  }
  if (removed) log?.push(`${removed} bad card${removed === 1 ? '' : 's'} cleared from your deck.`)
})

/** Puts `amount` copies of a card (a token: Tourist, Commuter...) into your discard pile. */
registerEffect('gainCard', (effect, { state, catalog, log }) => {
  const card = catalog?.[effect.card]
  if (!card) return
  const n = effect.amount ?? 1
  addToDiscardPile(state.deck, Array(n).fill(card))
  log?.push(`+${n} ${card.name} card${n === 1 ? '' : 's'} in your deck.`)
})

/** One copy of a card per neighbour tagged targetTag. */
registerEffect('gainCardPerAdjacent', (effect, { state, catalog, log, instanceId }) => {
  const card = catalog?.[effect.card]
  const n = neighborsOf(state, instanceId).filter(i => hasTag(i, effect.targetTag)).length
  if (!card || !n) return
  addToDiscardPile(state.deck, Array(n).fill(card))
  log?.push(`+${n} ${card.name} card${n === 1 ? '' : 's'} in your deck.`)
})
