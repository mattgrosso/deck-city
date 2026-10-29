// The goal deck/row: a second depleting market (same createRow pattern as
// the city row - see game.js), acting as the game's actual clock. Claiming
// a goal is free in treasury, priced by its condition (see
// conditions/coreConditions.js) instead; a claimed goal becomes a
// buildable, zero-cost, skipsRoadRequirement "monument" - see
// game.js's claimGoal and playCard. tier controls claim-order pressure:
// every 4 turns the lowest-tier unclaimed visible goal expires (see
// turn/phases.js), so cheap/early goals are the fragile, time-pressured
// ones. Costs/conditions/rewards are a first-pass judgment call, not final
// balance - same disclaimer as starterCards.js.
//
// Every goal here is buildable as a monument once claimed, each with a flat
// +1 revenue / +1 population - deliberately uniform rather than
// hand-tuned per goal, to keep this first content pass from ballooning into
// a full balancing pass. Real monument flavor (unique bonuses per goal) is
// future work, not a limitation of the engine - card.stats is already
// fully generic.

import { CARD_TYPES } from './cardSchema'

// A Monument is a building like any other: it needs a street (Matt: building one
// anywhere "feels a little weird").
const MONUMENT_STATS = { revenue: 1, population: 1 }

export const GOAL_GRAND_OPENING = {
  id: 'goal-grand-opening',
  type: CARD_TYPES.GOAL,
  name: 'Grand Opening',
  tier: 1,
  cost: 0,
  tags: ['monument'],
  stats: MONUMENT_STATS,
  condition: { type: 'populationAtLeast', amount: 6 },
  effects: { onComplete: [{ type: 'gainTreasury', amount: 5 }] }
}

export const GOAL_FULL_EMPLOYMENT = {
  id: 'goal-full-employment',
  type: CARD_TYPES.GOAL,
  name: 'Full Employment',
  tier: 1,
  cost: 0,
  tags: ['monument'],
  stats: MONUMENT_STATS,
  condition: { type: 'buildingCountAtLeast', cardId: 'commercial', amount: 2 },
  effects: { onComplete: [{ type: 'gainTreasury', amount: 5 }] }
}

export const GOAL_CLEAN_STREETS = {
  id: 'goal-clean-streets',
  type: CARD_TYPES.GOAL,
  name: 'Clean Streets',
  tier: 2,
  cost: 0,
  tags: ['monument'],
  stats: MONUMENT_STATS,
  condition: { type: 'statusCountAtMost', tag: 'trash', amount: 0 },
  effects: { onComplete: [{ type: 'gainTreasury', amount: 6 }] }
}

export const GOAL_PARK_DISTRICT = {
  id: 'goal-park-district',
  type: CARD_TYPES.GOAL,
  name: 'Park District',
  tier: 2,
  cost: 0,
  tags: ['monument'],
  stats: MONUMENT_STATS,
  condition: { type: 'adjacentPair', tagA: 'park', tagB: 'residential' },
  effects: { onComplete: [{ type: 'gainTreasury', amount: 6 }] }
}

export const GOAL_NEIGHBORHOOD_WATCH = {
  id: 'goal-neighborhood-watch',
  type: CARD_TYPES.GOAL,
  name: 'Neighborhood Watch',
  tier: 2,
  cost: 0,
  tags: ['monument'],
  stats: MONUMENT_STATS,
  condition: {
    type: 'all',
    conditions: [
      { type: 'populationAtLeast', amount: 10 },
      { type: 'buildingCountAtLeast', cardId: 'police-station', amount: 1 }
    ]
  },
  effects: { onComplete: [{ type: 'gainTreasury', amount: 7 }] }
}

export const GOAL_CITY_BANK = {
  id: 'goal-city-bank',
  type: CARD_TYPES.GOAL,
  name: 'City Bank',
  tier: 3,
  cost: 0,
  tags: ['monument'],
  stats: MONUMENT_STATS,
  condition: { type: 'treasuryAtLeast', amount: 8 },
  // +3 now as well (2026-10-29 economy): a tier-3 reward was worth less than every tier-2 one.
  effects: { onComplete: [{ type: 'gainTreasury', amount: 3 }, { type: 'raiseTreasuryRolloverCap', amount: 10 }] }
}

export const GOAL_HOUSING_ROW = {
  id: 'goal-housing-row',
  type: CARD_TYPES.GOAL,
  name: 'Housing Row',
  tier: 3,
  cost: 0,
  tags: ['monument'],
  stats: MONUMENT_STATS,
  condition: { type: 'adjacentChain', tag: 'residential', length: 3 },
  effects: { onComplete: [{ type: 'gainTreasury', amount: 8 }] }
}

const goal = (id, name, tier, condition, onComplete) => ({
  id, type: CARD_TYPES.GOAL, name, tier, cost: 0, tags: ['monument'], stats: MONUMENT_STATS, condition, effects: { onComplete }
})
const tagged = (tag, amount) => ({ type: 'tagCountAtLeast', tag, amount })

// Goals for the wider city (2026-10-29): each one pulls toward a theme the
// tiered buildings make possible. Rewards rise with tier (economy.test.js).
export const GOAL_GREEN_CITY = goal('goal-green-city', 'Green City', 1, tagged('green', 3), [{ type: 'gainTreasury', amount: 5 }])
export const GOAL_COMMUTER_TOWN = goal('goal-commuter-town', 'Commuter Town', 2, tagged('transit', 3), [{ type: 'gainTreasury', amount: 4 }, { type: 'drawCards', amount: 2 }])
export const GOAL_INDUSTRIAL_HEARTLAND = goal('goal-industrial-heartland', 'Industrial Heartland', 2, tagged('industrial', 5), [{ type: 'gainTreasury', amount: 6 }])
export const GOAL_SCHOOL_DISTRICT = goal('goal-school-district', 'School District', 2, tagged('education', 2), [{ type: 'gainTreasury', amount: 6 }])
export const GOAL_TOURIST_TRAP = goal('goal-tourist-trap', 'Tourist Trap', 3, tagged('landmark', 2), [{ type: 'gainTreasury', amount: 5 }, { type: 'gainCard', card: 'tourist', amount: 2 }])
export const GOAL_FULL_SERVICE = goal('goal-full-service', 'Full Service City', 3, { type: 'all', conditions: [tagged('safety', 1), tagged('health', 1), tagged('utility', 1)] }, [{ type: 'gainTreasury', amount: 9 }])

/** Every unique goal card, for merging into a game's cardCatalog. */
export const GOAL_CATALOG = [
  GOAL_GRAND_OPENING, GOAL_FULL_EMPLOYMENT, GOAL_CLEAN_STREETS, GOAL_PARK_DISTRICT,
  GOAL_NEIGHBORHOOD_WATCH, GOAL_CITY_BANK, GOAL_HOUSING_ROW,
  GOAL_GREEN_CITY, GOAL_COMMUTER_TOWN, GOAL_INDUSTRIAL_HEARTLAND, GOAL_SCHOOL_DISTRICT, GOAL_TOURIST_TRAP, GOAL_FULL_SERVICE
]

/** The goal deck: one copy of each goal, revealed 3 at a time. */
export const GOAL_DECK_CARDS = GOAL_CATALOG.map(card => card.id)
