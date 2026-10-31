// Public surface of the game engine. Vue components, Phaser scenes, and
// tests should import from here (`@/game/core`) rather than reaching into
// individual files, so the internal module layout can move around freely.

import './effects/coreEffects' // registers the starter effect vocabulary as a side effect
import './conditions/coreConditions' // registers the starter condition vocabulary as a side effect
import './effects/synergy' // growSelf, growNeighbors (and the watchers the engine fires)

export { createGame, discardsNeeded } from './game'

export { CARD_TYPES, validateCard, buildCardCatalog } from './cards/cardSchema'
export * as exampleCards from './cards/exampleCards'
export * as starterCards from './cards/starterCards'
export * as facilityCards from './cards/facilityCards'
export * as goalCards from './cards/goalCards'
export * as disasterCards from './cards/disasterCards'
export * as cityCards from './cards/cityCards'
export { MANDATES, mandatesOfEra } from './cards/mandates'
export { POLICIES, policyById, policyMod, marketPrice, roadSegmentsOf, policyPrice, slotCapacity, MILESTONES } from './cards/policies'
export { USES, defaultUses, usesLeft, isLimited, afterUse } from './cards/uses'
export { canCombine, canCombinePair, sizeOf, scaleOf, combineCost, combineOptions, NAMES as COMBO_NAMES } from './cards/combine'
export { mandateMet, DEFAULT_DRAIN } from './turn/run'

export { registerEffect, hasEffect, resolveEffect, resolveEffects, resolveTrigger } from './effects/effectRegistry'
export { registerCondition, hasCondition, evaluateCondition } from './conditions/conditionRegistry'
export { conditionProgress } from './conditions/coreConditions'

export {
  createDeck, shuffle, draw, discardCards, addToDrawPile, addToDiscardPile
} from './piles/deck'
export {
  createRow, fillRow, expireOldest, expireLowestValue, acquireFromRow, tickTimers
} from './piles/row'

export {
  createPlayerState,
  addTreasury,
  spendTreasury,
  addStatusCard,
  removeStatusCard,
  calcStatTotal,
  instanceStats,
  previewPlacement,
  countCardsByTag,
  buildStructure,
  placeRoad,
  expandSlots,
  resetSlotUsage,
  resetAllSlotUsage,
  addGoal,
  completeGoal,
  tickDisasterTimer,
  resetDisasterTimer,
  getAdjacentInstances,
  headOffDisaster,
  raiseTreasuryRolloverCap,
  seedStructure,
  countDisasterBlockers,
  clearStatusCard,
  effectiveCost,
  clearsOf,
  sumPassive,
  calcUpkeep,
  calcBudget,
  cellsOf
} from './state/playerState'
export {
  DEFAULT_CITY_GRID_SIZE,
  DEFAULT_STARTING_ROAD_CELLS,
  DEFAULT_STARTING_ROAD_EDGES,
  edgeKey,
  parseEdgeKey,
  isEdgeInBounds,
  addRoadEdge,
  listAllEdges,
  edgeNodes,
  isEdgeConnected,
  listConnectedEdges,
  isEdgeInsideBuilding,
  isInLimits,
  isEdgeInLimits,
  createCityGrid,
  isInBounds,
  isCellEmpty,
  placeInstance,
  findFirstEmptyCell,
  instanceAt,
  cellEdgeKeys,
  addRoadsAroundCell,
  hasRoadFrontage,
  isBuildable,
  listRoadEdges,
  seedStartingRoads
} from './state/cityGrid'

export { generateTerrain, isWater, touchesWater, WATERFRONT } from './state/terrain'
export { SHAPES, shapeOf, isMultiTile, turnOffsets, footprint, innerEdges, placementProblem } from './state/shapes'

export { DEFAULT_PHASES } from './turn/phases'
export {
  createTurnManager, getCurrentPhase, advancePhase, runPhase, assertPhase
} from './turn/turnManager'
export { choosePlacement, layStreets, needs as cityNeeds } from './state/autoPlace'
export { MONTH } from './turn/phases'
