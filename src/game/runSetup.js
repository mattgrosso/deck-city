// The run as the game is played - one place for the app (App.vue) and the
// robot (tools/selfplay.mjs) to build a game from, so what self-play tunes
// is exactly what Matt plays.

import { starterCards, facilityCards, goalCards, disasterCards, cityCards } from './core'

/** The whole map; each era opens a wider part of it. */
export const GRID = { width: 24, height: 16 }
/** A short street in the middle. */
export const STARTING_ROAD_EDGES = ['h:11,8', 'h:12,8']
/** The city you start with: its revenue IS the first budget (5). */
export const STARTING_BUILDINGS = [
  { cardId: 'residential', x: 11, y: 7 }, // 2 people, +1
  { cardId: 'commercial', x: 12, y: 7 }, // 2 jobs, +2, +1 for the house next door
  { cardId: 'industrial', x: 12, y: 8 } // 3 jobs, +1, kept off the house
]

/**
 * Three eras (Matt: "an act in Slay the Spire is somewhere between 6 and 10
 * combats, and each combat 3-10 turns"): Patience is each era's clock,
 * `limits` the part of the map the city may use, `cardIds` the tier that
 * joins the market. Patience and the mandates' numbers are tuned with
 * `yarn selfplay`.
 */
export const RUN = {
  offerSize: 2,
  eras: [
    { patience: 180, limits: { x0: 6, y0: 4, x1: 18, y1: 12 }, cardIds: [] },
    { patience: 140, limits: { x0: 3, y0: 2, x1: 21, y1: 14 }, cardIds: cityCards.cityCardsOfTier(2) },
    { patience: 160, limits: { x0: 0, y0: 0, x1: 24, y1: 16 }, cardIds: cityCards.cityCardsOfTier(3) }
  ],
  drain: { base: 1, floor: 3, perBadCards: 6, maxBad: 5, unemployment: 1, disaster: 4, chance: 3 }
}

/** createGame's options for a run. */
export function runGameOptions ({ rng } = {}) {
  return {
    cardCatalog: [
      ...starterCards.STARTER_CARD_CATALOG, ...facilityCards.FACILITY_CATALOG,
      ...goalCards.GOAL_CATALOG, ...disasterCards.DISASTER_CATALOG, ...cityCards.CITY_CATALOG
    ],
    startingDeckCardIds: starterCards.STARTER_DECK_CARDS,
    cityDeckCardIds: [...facilityCards.CITY_DECK_CARDS, ...cityCards.cityCardsOfTier(1)],
    goalDeckCardIds: goalCards.GOAL_DECK_CARDS,
    disasterCardIds: disasterCards.DISASTER_CARDS,
    baseRevenue: 0,
    gridSize: GRID,
    startingRoadEdges: STARTING_ROAD_EDGES,
    startingBuildings: STARTING_BUILDINGS,
    run: RUN,
    // Roads are always for sale beside the city row (yarn selfplay: cities
    // stalled with budget to spare and no street to build on).
    supplyCardIds: ['road'],
    // A new map each game: a river, a lake or a coast, never on the town.
    terrain: { dry: { x0: 9, y0: 5, x1: 15, y1: 11 }, firstEra: RUN.eras[0].limits },
    ...(rng ? { rng } : {})
  }
}
