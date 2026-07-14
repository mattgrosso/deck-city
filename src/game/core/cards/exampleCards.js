// Illustrative cards proving the schema spans every card family. These are
// NOT balanced content — real starter-deck, city-deck, goal-deck, and
// disaster-deck cards are a separate future task. This file exists to seed
// engine tests and give a concrete shape to copy when authoring real cards.

import { CARD_TYPES } from './cardSchema'

export const ROAD = {
  id: 'road',
  type: CARD_TYPES.BUILDING,
  name: 'Road',
  cost: 1,
  tags: ['infrastructure'],
  stats: {}
}

export const CRIME = {
  id: 'crime',
  type: CARD_TYPES.STATUS,
  name: 'Crime',
  tags: ['negative', 'crime']
}

export const RESIDENTIAL = {
  id: 'residential',
  type: CARD_TYPES.BUILDING,
  name: 'Residential',
  cost: 3,
  tags: ['residential'],
  stats: { population: 2, revenue: 1 },
  effects: {
    onBuild: [{ type: 'gainStatus', card: CRIME.id, amount: 1 }]
  }
}

export const CLINIC = {
  id: 'clinic',
  type: CARD_TYPES.BUILDING,
  name: 'Clinic',
  cost: 5,
  tags: ['consumer'],
  stats: { revenue: 1 },
  slots: { capacity: 5, expandable: true, maxMultiplier: 2 },
  effects: {
    onTurnStart: [
      { type: 'consumeStatus', card: CRIME.id, amount: 1, requiresSlot: true, buildingId: 'self' }
    ]
  }
}

export const GOAL_UNIVERSITY = {
  id: 'goal-university',
  type: CARD_TYPES.GOAL,
  name: 'Build a University',
  tier: 1,
  condition: { type: 'buildingBuilt', cardId: 'university' },
  effects: {
    onComplete: [{ type: 'gainTreasury', amount: 10 }]
  }
}

export const FLOOD = {
  id: 'flood',
  type: CARD_TYPES.DISASTER,
  name: 'Flood',
  tags: ['negative'],
  effects: {
    onDraw: [{ type: 'spendTreasury', amount: 2 }]
  }
}

export const EXAMPLE_CARDS = [ROAD, CRIME, RESIDENTIAL, CLINIC, GOAL_UNIVERSITY, FLOOD]
