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
  expandSlots
} from '../state/playerState'
import { draw } from '../piles/deck'

registerEffect('gainTreasury', (effect, { state, log }) => {
  addTreasury(state, effect.amount)
  log?.push(`+${effect.amount} treasury`)
})

registerEffect('spendTreasury', (effect, { state, log }) => {
  spendTreasury(state, effect.amount)
  log?.push(`-${effect.amount} treasury`)
})

/**
 * effect: { type: 'gainStatus', card: <status card id>, amount? }
 * Looks the id up in context.catalog since effect descriptors reference
 * other cards by id, not by embedding the full card object.
 */
registerEffect('gainStatus', (effect, { state, catalog, log }) => {
  const card = catalog[effect.card]
  addStatusCard(state, card, effect.amount ?? 1)
  log?.push(`+${effect.amount ?? 1} ${card.name}`)
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
  log?.push(`-${removed} ${card.name}`)
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
