// City-row content: acquirable via the 'acquire' phase (spend treasury,
// card enters your deck's discard pile), not part of the starter deck -
// "something you want, not just afford" per the design notes. One
// dedicated consumer per status type, plus Fire Station (disaster
// counterplay) and Park (the adjacency showcase). Costs/stats are a
// first-pass judgment call, not final balance - same disclaimer as
// starterCards.js.

import { CARD_TYPES } from './cardSchema'
import { CRIME, TRASH, POLLUTION } from './starterCards'

export const POLICE_STATION = {
  id: 'police-station',
  type: CARD_TYPES.BUILDING,
  name: 'Police Station',
  cost: 4,
  tags: ['consumer'],
  stats: {},
  slots: { capacity: 2, expandable: true, maxMultiplier: 2 },
  effects: {
    onTurnStart: [{ type: 'consumeStatus', card: CRIME.id, amount: 1, requiresSlot: true, buildingId: 'self' }]
  }
}

export const SANITATION_CENTER = {
  id: 'sanitation-center',
  type: CARD_TYPES.BUILDING,
  name: 'Sanitation Center',
  cost: 4,
  tags: ['consumer'],
  stats: {},
  slots: { capacity: 2, expandable: true, maxMultiplier: 2 },
  effects: {
    onTurnStart: [{ type: 'consumeStatus', card: TRASH.id, amount: 1, requiresSlot: true, buildingId: 'self' }]
  }
}

export const CLINIC = {
  id: 'clinic',
  type: CARD_TYPES.BUILDING,
  name: 'Clinic',
  cost: 5,
  tags: ['consumer'],
  stats: {},
  slots: { capacity: 2, expandable: true, maxMultiplier: 2 },
  effects: {
    onTurnStart: [{ type: 'consumeStatus', card: POLLUTION.id, amount: 1, requiresSlot: true, buildingId: 'self' }]
  }
}

export const FIRE_STATION = {
  id: 'fire-station',
  type: CARD_TYPES.BUILDING,
  name: 'Fire Station',
  cost: 5,
  tags: ['civic'],
  stats: {},
  effects: {
    // Permanent, one-time - see playerState.js's headOffDisaster. A second
    // copy built later is a harmless no-op, not a stacking effect.
    onBuild: [{ type: 'headOffDisaster' }]
  }
}

export const PARK = {
  id: 'park',
  type: CARD_TYPES.BUILDING,
  name: 'Park',
  cost: 3,
  tags: ['park'],
  stats: {},
  adjacency: {
    statBonus: [{ stat: 'revenue', amount: 1, targetTag: 'residential' }]
  },
  effects: {
    onTurnStart: [{ type: 'gainStatusPerAdjacent', card: CRIME.id, targetTag: 'residential' }]
  }
}

/** Every unique facility card, for merging into a game's cardCatalog. */
export const FACILITY_CATALOG = [POLICE_STATION, SANITATION_CENTER, CLINIC, FIRE_STATION, PARK]

/** The city-row deck: 2 copies of each facility (10 cards), revealed 4 at a time. */
export const CITY_DECK_CARDS = FACILITY_CATALOG.flatMap(card => [card.id, card.id])
