// The single entry point that wires the rest of core/ together: resolves a
// card catalog, builds player state and the city row, and returns the
// gated actions (playCard, acquireCard, advance) a future Vue HUD or
// Phaser scene (or a test) drives the game with.

import { CARD_TYPES, buildCardCatalog } from './cards/cardSchema'
import { createPlayerState, buildStructure, placeRoad, spendTreasury } from './state/playerState'
import { isCellEmpty, isBuildable } from './state/cityGrid'
import { createDeck, addToDiscardPile } from './piles/deck'
import { createRow, acquireFromRow } from './piles/row'
import { createTurnManager, advancePhase, assertPhase } from './turn/turnManager'
import { resolveTrigger } from './effects/effectRegistry'
import './effects/coreEffects' // registers the starter effect vocabulary as a side effect

/**
 * @param {Object} options
 * @param {Object[]} options.cardCatalog - every card definition in the game
 * @param {string[]} [options.startingDeckCardIds]
 * @param {string[]} [options.cityDeckCardIds]
 * @param {number} [options.cityRowSize]
 * @param {number} [options.handSize]
 * @param {number} [options.treasury]
 * @param {() => number} [options.rng]
 */
export function createGame ({
  cardCatalog = [],
  startingDeckCardIds = [],
  cityDeckCardIds = [],
  cityRowSize = 4,
  handSize = 5,
  treasury = 0,
  rng
} = {}) {
  const catalog = buildCardCatalog(cardCatalog)

  const resolveCard = (id) => {
    const card = catalog[id]
    if (!card) throw new Error(`Unknown card id: "${id}"`)
    return card
  }

  const state = createPlayerState({
    startingDeckCards: startingDeckCardIds.map(resolveCard),
    treasury,
    rng
  })

  const cityDeck = createDeck({ id: 'city', cards: cityDeckCardIds.map(resolveCard), rng })
  const cityRow = createRow({ sourceDeck: cityDeck, size: cityRowSize })

  const turnManager = createTurnManager({ state })
  const log = []
  const context = { state, catalog, cityRow, log, handSize }

  function playCard (cardId, position) {
    assertPhase(turnManager, 'build')
    const index = state.hand.findIndex(card => card.id === cardId)
    if (index === -1) throw new Error(`Card "${cardId}" is not in hand`)

    const card = state.hand[index]

    if (!position || !isCellEmpty(state.cityGrid, position.x, position.y)) {
      throw new Error(`Invalid or occupied cell: ${JSON.stringify(position)}`)
    }
    // Road cards create road frontage, so they don't require it themselves —
    // everything else can only be built on a cell with an adjacent road.
    if (!card.placesRoad && !isBuildable(state.cityGrid, position.x, position.y)) {
      throw new Error(`Cell (${position.x}, ${position.y}) has no road access`)
    }

    state.hand.splice(index, 1)
    spendTreasury(state, card.cost ?? 0)

    if (card.placesRoad) {
      return placeRoad(state, card, { ...context, position })
    }
    return buildStructure(state, card, { ...context, position })
  }

  function playCivicCard (cardId, discardCardIds = []) {
    assertPhase(turnManager, 'build')
    const index = state.hand.findIndex(card => card.id === cardId)
    if (index === -1) throw new Error(`Card "${cardId}" is not in hand`)

    const card = state.hand[index]
    if (card.type !== CARD_TYPES.CIVIC) throw new Error(`Card "${cardId}" is not a civic card`)

    state.hand.splice(index, 1)
    resolveTrigger(card, 'onPlay', { ...context, cardIds: discardCardIds })
    addToDiscardPile(state.deck, [card])
    return card
  }

  function acquireCard (cardId) {
    assertPhase(turnManager, 'acquire')
    const card = acquireFromRow(cityRow, cardId)
    if (!card) throw new Error(`Card "${cardId}" is not in the city row`)

    spendTreasury(state, card.cost ?? 0)
    addToDiscardPile(state.deck, [card])
    return card
  }

  function advance () {
    return advancePhase(turnManager, context)
  }

  return {
    state,
    cityRow,
    turnManager,
    catalog,
    log,
    actions: { playCard, playCivicCard, acquireCard, advance }
  }
}
