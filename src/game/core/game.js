// The single entry point that wires the rest of core/ together: resolves a
// card catalog, builds player state, the city row, and the goal row,
// returns the gated actions (playCard, acquireCard, claimGoal, advance) a
// future Vue HUD or Phaser scene (or a test) drives the game with.

import { CARD_TYPES, buildCardCatalog } from './cards/cardSchema'
import { createPlayerState, buildStructure, placeRoad, spendTreasury, seedStructure, clearStatusCard } from './state/playerState'
import { isCellEmpty, isBuildable, isEdgeInBounds, isEdgeConnected } from './state/cityGrid'
import { createDeck, addToDiscardPile } from './piles/deck'
import { createRow, acquireFromRow } from './piles/row'
import { createTurnManager, advancePhase, assertPhase } from './turn/turnManager'
import { resolveTrigger } from './effects/effectRegistry'
import { evaluateCondition } from './conditions/conditionRegistry'
import './effects/coreEffects' // registers the starter effect vocabulary as a side effect
import './conditions/coreConditions' // registers the starter condition vocabulary as a side effect

/**
 * Throws if the game has already ended - the shared guard for every
 * meaningful player action (build/acquire/claim). Phase advancement is
 * deliberately NOT gated by this: letting the player keep clicking through
 * phases after a win/loss is harmless, and not gating it means the UI
 * doesn't need special-case logic just to avoid a stuck "Next phase"
 * button.
 * @param {Object} state
 */
function assertPlaying (state) {
  if (state.gameStatus !== 'playing') {
    throw new Error(`Game is already over (${state.gameStatus})`)
  }
}

/**
 * @param {Object} options
 * @param {Object[]} options.cardCatalog - every card definition in the game
 * @param {string[]} [options.startingDeckCardIds]
 * @param {string[]} [options.cityDeckCardIds]
 * @param {number} [options.cityRowSize]
 * @param {string[]} [options.goalDeckCardIds]
 * @param {number} [options.goalRowSize]
 * @param {string[]} [options.disasterCardIds] - shuffled into the draw pile, one at random, whenever the disaster timer hits its deadline unheaded-off
 * @param {number} [options.handSize]
 * @param {number} [options.treasury] - starting treasury, before the first 'draw' phase's budget reset ever runs
 * @param {number} [options.baseRevenue] - flat municipal income added to building revenue every budget reset; see turn/phases.js for why this can't be 0
 * @param {number} [options.populationTarget] - win condition, checked every 'endOfTurn'
 * @param {{cardId: string, x: number, y: number}[]} [options.startingBuildings] - stood in the city before turn one, no effects, no cards
 * @param {(card: Object) => number} [options.goalTimerFor] - turns a goal stays on offer; default 3 + tier
 * @param {() => number} [options.rng]
 */
export function createGame ({
  cardCatalog = [],
  startingDeckCardIds = [],
  cityDeckCardIds = [],
  cityRowSize = 4,
  goalDeckCardIds = [],
  goalRowSize = 3,
  disasterCardIds = [],
  handSize = 5,
  treasury = 0,
  baseRevenue = 4,
  populationTarget = 20,
  startingBuildings = [],
  goalTimerFor = (card) => 3 + (card.tier ?? 1),
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

  const goalDeck = createDeck({ id: 'goal', cards: goalDeckCardIds.map(resolveCard), rng })
  const goalRow = createRow({ sourceDeck: goalDeck, size: goalRowSize, timerFor: goalTimerFor })

  startingBuildings.forEach(({ cardId, x, y }) => seedStructure(state, resolveCard(cardId), { x, y }))

  const disasterCards = disasterCardIds.map(resolveCard)

  const turnManager = createTurnManager({ state })
  const log = []
  const context = {
    state,
    catalog,
    cityRow,
    goalRow,
    // Distinguishes "the goal deck was configured and has genuinely run
    // dry" (a real loss) from "no goal content was ever set up" (e.g. an
    // engine test that only cares about the city row) - without this,
    // checkGameStatus (turn/phases.js) would see an empty, unconfigured
    // goal deck as already-exhausted and end the game on turn 1.
    hasGoals: goalDeckCardIds.length > 0,
    disasterCards,
    log,
    handSize,
    turnManager,
    baseRevenue,
    populationTarget
  }

  function playCard (cardId, position) {
    assertPlaying(state)
    assertPhase(turnManager, 'build')
    const index = state.hand.findIndex(card => card.id === cardId)
    if (index === -1) throw new Error(`Card "${cardId}" is not in hand`)

    const card = state.hand[index]

    // A Road card lays up to `roadSegments` (default 2) street segments,
    // each an EDGE between two spaces ({ edges: ['h:2,2', 'h:3,2'] }); the
    // first must touch the street network, each next one the network or
    // the ones before it. Never a cell.
    if (card.placesRoad) {
      const edges = position?.edges ?? (position?.edge ? [position.edge] : [])
      const max = card.roadSegments ?? 2
      if (!edges.length || edges.length > max) throw new Error(`A ${card.name} lays 1 to ${max} segments, got ${edges.length}`)
      const laid = []
      for (const edge of edges) {
        if (!isEdgeInBounds(state.cityGrid, edge)) throw new Error(`Invalid edge: ${edge}`)
        if (state.cityGrid.roads.has(edge) || laid.includes(edge)) throw new Error(`Edge ${edge} already has a road`)
        if (!isEdgeConnected(state.cityGrid, edge, laid)) throw new Error(`Edge ${edge} does not touch a street`)
        laid.push(edge)
      }
      state.hand.splice(index, 1)
      spendTreasury(state, card.cost ?? 0)
      edges.forEach((edge, i) => placeRoad(state, i === 0 ? card : { ...card, effects: {} }, { ...context, edge, intoDeck: i === 0 }))
      return edges
    }

    if (!position || !isCellEmpty(state.cityGrid, position.x, position.y)) {
      throw new Error(`Invalid or occupied cell: ${JSON.stringify(position)}`)
    }
    // Monuments (claimed goals) skip the requirement entirely (see
    // cards/goalCards.js); everything else can only be built on a cell with
    // an adjacent road.
    if (!card.skipsRoadRequirement && !isBuildable(state.cityGrid, position.x, position.y)) {
      throw new Error(`Cell (${position.x}, ${position.y}) has no road access`)
    }

    state.hand.splice(index, 1)
    spendTreasury(state, card.cost ?? 0)
    return buildStructure(state, card, { ...context, position })
  }

  function playCivicCard (cardId, discardCardIds = []) {
    assertPlaying(state)
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
    assertPlaying(state)
    assertPhase(turnManager, 'acquire')
    const card = cityRow.cards.find(c => c.id === cardId)
    if (!card) throw new Error(`Card "${cardId}" is not in the city row`)
    // The market charges a card's PRICE; its cost is paid again to build it.
    spendTreasury(state, card.price ?? card.cost ?? 0)
    acquireFromRow(cityRow, cardId)
    addToDiscardPile(state.deck, [card])
    return card
  }

  /**
   * Claims a visible goal: free in treasury, priced instead by its
   * condition (see conditions/coreConditions.js) actually being met right
   * now. A claimed goal enters the discard pile just like an acquired
   * city-row card, so it cycles into hand normally - see
   * cards/goalCards.js, every goal card is also a zero-cost,
   * skipsRoadRequirement building (a "monument") once claimed.
   * @param {string} goalId
   */
  function claimGoal (goalId) {
    assertPlaying(state)
    assertPhase(turnManager, 'acquire')
    const goal = goalRow.cards.find(card => card.id === goalId)
    if (!goal) throw new Error(`Goal "${goalId}" is not in the goal row`)

    if (!evaluateCondition(goal.condition, { state, catalog })) {
      throw new Error(`Goal "${goal.name}" condition is not yet met`)
    }
    if ((state.goalsClaimedThisTurn ?? 0) >= 1) throw new Error('Only one goal may be claimed a turn')

    acquireFromRow(goalRow, goalId)
    addToDiscardPile(state.deck, [goal])
    state.goalsClaimedThisTurn = (state.goalsClaimedThisTurn ?? 0) + 1
    log.push(`Goal claimed: ${goal.name}. It is a Monument in your deck now.`)
    return goal
  }

  /** Trash a status card from the hand into a facility with a free slot (build phase). */
  function clearStatus (cardId) {
    assertPlaying(state)
    assertPhase(turnManager, 'build')
    const instance = clearStatusCard(state, cardId)
    log.push(`${instance.card.name} took a ${catalog[cardId]?.name ?? cardId} card out of your deck.`)
    return instance
  }

  function advance () {
    return advancePhase(turnManager, context)
  }

  return {
    state,
    cityRow,
    goalRow,
    turnManager,
    catalog,
    log,
    actions: { playCard, playCivicCard, acquireCard, claimGoal, clearStatus, advance }
  }
}
