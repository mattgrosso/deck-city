// Shuffled one-at-random into the player's draw pile when the disaster
// timer (state.disasterTimer, see state/playerState.js) hits its deadline
// unheaded-off by a Fire Station (see cards/facilityCards.js) - see
// turn/phases.js's triggerDisaster. Each bites via 'onDraw', the same
// immediate-on-draw trigger any card can use, resolved the moment it lands
// in hand (see the 'draw' phase) - no special-cased "disaster resolution"
// step in the engine, just ordinary card effects.

import { CARD_TYPES } from './cardSchema'
import { CRIME } from './starterCards'

export const FLOOD = {
  id: 'flood',
  type: CARD_TYPES.DISASTER,
  name: 'Flood',
  tags: ['negative'],
  effects: {
    onDraw: [{ type: 'spendTreasury', amount: 3 }]
  }
}

export const BLACKOUT = {
  id: 'blackout',
  type: CARD_TYPES.DISASTER,
  name: 'Blackout',
  tags: ['negative'],
  effects: {
    onDraw: [{ type: 'gainStatus', card: CRIME.id, amount: 1 }]
  }
}

/** Every unique disaster card, for merging into a game's cardCatalog. */
export const DISASTER_CATALOG = [FLOOD, BLACKOUT]

/** Passed as createGame's disasterCardIds - one is picked at random each time the timer deadlines. */
export const DISASTER_CARDS = DISASTER_CATALOG.map(card => card.id)
