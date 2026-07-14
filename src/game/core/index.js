// Public surface of the game engine. Vue components, Phaser scenes, and
// tests should import from here (`@/game/core`) rather than reaching into
// individual files, so the internal module layout can move around freely.

import './effects/coreEffects' // registers the starter effect vocabulary as a side effect

export { createGame } from './game'

export { CARD_TYPES, validateCard, buildCardCatalog } from './cards/cardSchema'
export * as exampleCards from './cards/exampleCards'

export { registerEffect, hasEffect, resolveEffect, resolveEffects, resolveTrigger } from './effects/effectRegistry'

export {
  createDeck, shuffle, draw, discardCards, addToDrawPile, addToDiscardPile
} from './piles/deck'
export { createRow, fillRow, expireOldest, acquireFromRow } from './piles/row'

export {
  createPlayerState,
  addTreasury,
  spendTreasury,
  addStatusCard,
  removeStatusCard,
  calcStatTotal,
  countCardsByTag,
  buildStructure,
  expandSlots,
  resetSlotUsage,
  resetAllSlotUsage,
  addGoal,
  completeGoal,
  tickDisasterTimer,
  resetDisasterTimer
} from './state/playerState'

export { DEFAULT_PHASES } from './turn/phases'
export {
  createTurnManager, getCurrentPhase, advancePhase, runPhase, assertPhase
} from './turn/turnManager'
