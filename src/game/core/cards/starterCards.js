// The actual starter deck — real content, unlike exampleCards.js (which
// stays a small illustrative set the engine's own tests use to prove the
// schema). Costs, stats, and the 10-card mix here are a first-pass
// judgment call, not final balance.

import { CARD_TYPES } from './cardSchema'

export const ROAD = {
  id: 'road',
  type: CARD_TYPES.BUILDING,
  name: 'Road',
  cost: 1,
  placesRoad: true,
  tags: ['infrastructure']
}

export const CRIME = {
  id: 'crime',
  type: CARD_TYPES.STATUS,
  name: 'Crime',
  tags: ['negative', 'crime']
}

export const TRASH = {
  id: 'trash',
  type: CARD_TYPES.STATUS,
  name: 'Trash',
  tags: ['negative', 'trash']
}

export const POLLUTION = {
  id: 'pollution',
  type: CARD_TYPES.STATUS,
  name: 'Pollution',
  tags: ['negative', 'pollution']
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

export const COMMERCIAL = {
  id: 'commercial',
  type: CARD_TYPES.BUILDING,
  name: 'Commercial',
  cost: 3,
  tags: ['commercial'],
  stats: { jobs: 2, revenue: 2 },
  effects: {
    onBuild: [{ type: 'gainStatus', card: TRASH.id, amount: 1 }]
  }
}

export const INDUSTRIAL = {
  id: 'industrial',
  type: CARD_TYPES.BUILDING,
  name: 'Industrial',
  cost: 4,
  tags: ['industrial'],
  stats: { jobs: 3, revenue: 2 },
  effects: {
    onBuild: [{ type: 'gainStatus', card: POLLUTION.id, amount: 1 }]
  }
}

export const CIVIC_RECYCLE = {
  id: 'civic-recycle',
  type: CARD_TYPES.CIVIC,
  name: 'Civic Works',
  cost: 0,
  tags: ['civic'],
  effects: {
    onPlay: [
      { type: 'discardCards' },
      { type: 'drawCards', amount: 2 }
    ]
  }
}

/** Every unique card used by the starter deck — pass as createGame's cardCatalog. */
export const STARTER_CARD_CATALOG = [
  ROAD, RESIDENTIAL, COMMERCIAL, INDUSTRIAL, CIVIC_RECYCLE, CRIME, TRASH, POLLUTION
]

/** The 10-card starting deck: 3 Road, 2 Residential, 2 Commercial, 2 Industrial, 1 Civic Works. */
export const STARTER_DECK_CARDS = [
  ROAD.id, ROAD.id, ROAD.id,
  RESIDENTIAL.id, RESIDENTIAL.id,
  COMMERCIAL.id, COMMERCIAL.id,
  INDUSTRIAL.id, INDUSTRIAL.id,
  CIVIC_RECYCLE.id
]
