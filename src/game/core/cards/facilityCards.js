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
  price: 1, // to buy it at the market; `cost` is to build it
  tags: ['consumer'],
  stats: {},
  slots: { capacity: 2, expandable: true, maxMultiplier: 2 },
  // Cleared BY HAND: play a Crime card from your hand into a free slot and it
  // leaves the game (game.js clearStatus). Nothing happens on its own.
  clears: CRIME.id
}

export const SANITATION_CENTER = {
  id: 'sanitation-center',
  type: CARD_TYPES.BUILDING,
  name: 'Sanitation Center',
  cost: 4,
  price: 1, // to buy it at the market; `cost` is to build it
  tags: ['consumer'],
  stats: {},
  slots: { capacity: 2, expandable: true, maxMultiplier: 2 },
  // Cleared BY HAND: play a Trash card from your hand into a free slot and it
  // leaves the game (game.js clearStatus). Nothing happens on its own.
  clears: TRASH.id
}

export const CLINIC = {
  id: 'clinic',
  type: CARD_TYPES.BUILDING,
  name: 'Clinic',
  cost: 5,
  price: 1, // to buy it at the market; `cost` is to build it
  tags: ['consumer'],
  stats: {},
  slots: { capacity: 2, expandable: true, maxMultiplier: 2 },
  // Cleared BY HAND: play a Pollution card from your hand into a free slot and it
  // leaves the game (game.js clearStatus). Nothing happens on its own.
  clears: POLLUTION.id
}

export const FIRE_STATION = {
  id: 'fire-station',
  type: CARD_TYPES.BUILDING,
  name: 'Fire Station',
  cost: 5,
  price: 2, // to buy it at the market; `cost` is to build it
  tags: ['civic'],
  stats: {},
  // Each standing Fire Station blocks one disaster card per strike, and
  // strikes escalate (the Nth strike brings N cards) - so a second station
  // matters later. Matt: "why would I ever build more than one?"
  blocksDisasters: true
}

export const PARK = {
  id: 'park',
  type: CARD_TYPES.BUILDING,
  name: 'Park',
  cost: 2,
  price: 1, // to buy it at the market; `cost` is to build it
  tags: ['park'],
  stats: {},
  // A Crime card per neighbouring house EVERY turn cost the Park about ten
  // budget over a game against ~2.4 earned (docs/ECONOMY.md, 2026-10-29):
  // nobody would build one. The crime is gone; the Park is the house's friend.
  adjacency: {
    statBonus: [{ stat: 'revenue', amount: 1, targetTag: 'residential' }]
  }
}

// A civic card from the city row: an extra buy this turn, and a card.
// Played in the build phase, spent in the market. Priced in docs/ECONOMY.md.
export const TRADE_FAIR = {
  id: 'trade-fair',
  type: CARD_TYPES.CIVIC,
  name: 'Trade Fair',
  cost: 2,
  price: 1,
  tags: ['civic'],
  effects: {
    onPlay: [{ type: 'gainBuys', amount: 1 }, { type: 'drawCards', amount: 1 }]
  }
}

/** Every unique facility card, for merging into a game's cardCatalog. */
export const FACILITY_CATALOG = [POLICE_STATION, SANITATION_CENTER, CLINIC, FIRE_STATION, PARK, TRADE_FAIR]

/** The city-row deck: 2 copies of each facility (10 cards), revealed 4 at a time. */
export const CITY_DECK_CARDS = FACILITY_CATALOG.flatMap(card => [card.id, card.id])
