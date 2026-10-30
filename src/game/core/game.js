// The single entry point that wires the rest of core/ together: resolves a
// card catalog, builds player state, the city row, and the goal row,
// returns the gated actions (playCard, acquireCard, claimGoal, advance) a
// future Vue HUD or Phaser scene (or a test) drives the game with.

import { CARD_TYPES, buildCardCatalog } from './cards/cardSchema'
import { addTreasury, createPlayerState, buildStructure, placeRoad, spendTreasury, seedStructure, clearStatusCard, effectiveCost } from './state/playerState'
import { isEdgeInBounds, isEdgeConnected, isEdgeInLimits, isEdgeInsideBuilding } from './state/cityGrid'
import { placementProblem } from './state/shapes'
import { generateTerrain } from './state/terrain'
import { canCombine, canCombinePair, combineCost, combineOptions } from './cards/combine'
import { policyMod, marketPrice, roadSegmentsOf, policyPrice } from './cards/policies'
import { createRun, choosePolicy as chooseRunPolicy, chooseMandate as chooseRunMandate, callElection as callRunElection, goEndless } from './turn/run'
import { createDeck, addToDiscardPile, shuffle } from './piles/deck'
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
 * @param {{tier: number, at: number, cardIds: string[]}[]} [options.cityTiers] - shuffled into the city deck when population reaches `at`
 * @param {number} [options.buysPerTurn] - city-row purchases a turn before any gainBuys
 * @param {(card: Object) => number} [options.goalTimerFor] - turns a goal stays on offer; default 3 + tier
 * @param {{width: number, height: number}} [options.gridSize]
 * @param {string[]} [options.startingRoadEdges]
 * @param {string[]} [options.supplyCardIds] - always for sale beside the city row, never sold out (Roads)
 * @param {Object} [options.run] - a run of eras, mandates and patience (turn/run.js); without it the old population-target game
 * @param {{dry?: Object, firstEra?: Object}|null} [options.terrain] - lay water on the map (state/terrain.js); off by default
 * @param {{per: number, free?: number}|null} [options.upkeep] - budget a turn per building past the first `free` (state/playerState.js calcUpkeep)
 * @param {boolean} [options.shuffleStartingDeck] - default true; tests turn it off to deal in list order
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
  buysPerTurn = 1,
  cityTiers = [],
  shuffleMarkets = true,
  shuffleStartingDeck = true,
  terrain = null,
  upkeep = null,
  gridSize,
  startingRoadEdges,
  run = null,
  supplyCardIds = [],
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
    rng,
    gridSize,
    startingRoadEdges
  })
  // Matt: "I start with exactly the same five cards every time." The starting
  // deck was dealt in list order; it is shuffled like every reshuffle after.
  if (shuffleStartingDeck) shuffle(state.deck)
  state.upkeep = upkeep
  state.policies = [] // the run's relics (cards/policies.js)

  // The market and the goals are shuffled at the start (they were not, so the
  // city row dealt in list order and the same three goals opened every game).
  const cityDeck = createDeck({ id: 'city', cards: cityDeckCardIds.map(resolveCard), rng })
  if (shuffleMarkets) shuffle(cityDeck)
  const cityRow = createRow({ sourceDeck: cityDeck, size: cityRowSize })

  // Cards always for sale beside the row (Roads): bought without leaving the supply.
  const supply = supplyCardIds.map(resolveCard)

  const goalDeck = createDeck({ id: 'goal', cards: goalDeckCardIds.map(resolveCard), rng })
  if (shuffleMarkets) shuffle(goalDeck)
  const goalRow = createRow({ sourceDeck: goalDeck, size: goalRowSize, timerFor: goalTimerFor })

  // A new map each game (before the town is seeded, which is kept dry).
  if (terrain) state.terrainKind = generateTerrain(state.cityGrid, state.deck.rng, terrain)
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
    populationTarget,
    buysPerTurn,
    cityTiers: cityTiers.map(t => ({ tier: t.tier, at: t.at, cards: t.cardIds.map(resolveCard) }))
  }

  // A run: eras, mandates, patience (turn/run.js). Hooks the context so the
  // end of turn can drain patience and hold elections.
  if (run) {
    context.run = run
    state.run = createRun(context)
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
      const max = roadSegmentsOf(state, card) // Street Grid Act adds one
      if (!edges.length || edges.length > max) throw new Error(`A ${card.name} lays 1 to ${max} segments, got ${edges.length}`)
      const laid = []
      for (const edge of edges) {
        if (!isEdgeInBounds(state.cityGrid, edge)) throw new Error(`Invalid edge: ${edge}`)
        if (state.cityGrid.roads.has(edge) || laid.includes(edge)) throw new Error(`Edge ${edge} already has a road`)
        if (!isEdgeConnected(state.cityGrid, edge, laid)) throw new Error(`Edge ${edge} does not touch a street`)
        if (!isEdgeInLimits(state.cityGrid, edge)) throw new Error(`Edge ${edge} is outside the city limits`)
        if (isEdgeInsideBuilding(state.cityGrid, edge)) throw new Error('A street cannot run through a building')
        laid.push(edge)
      }
      state.hand.splice(index, 1)
      spendTreasury(state, effectiveCost(state, card))
      // A one-use card (a Street Permit) is gone once its segments are down.
      edges.forEach((edge, i) => placeRoad(state, i === 0 ? card : { ...card, effects: {} }, { ...context, edge, intoDeck: i === 0 && !card.exhaust }))
      return edges
    }

    if (!position) throw new Error('Invalid or occupied cell: undefined')
    if (card.unique && state.builtStructures.some(i => i.card.id === card.id)) {
      throw new Error(`There can only be one ${card.name}`)
    }
    // Monuments (claimed goals) skip the requirement entirely (see
    // cards/goalCards.js); everything else can only be built on a cell with
    // an adjacent road.
    // Every cell it covers (state/shapes.js): on the map, in the limits, empty, a street beside one.
    const problem = placementProblem(state, card, position, position.rotation ?? 0)
    if (problem) throw new Error(problem)

    state.hand.splice(index, 1)
    spendTreasury(state, effectiveCost(state, card))
    return buildStructure(state, card, { ...context, position: { x: position.x, y: position.y }, rotation: position.rotation ?? 0 })
  }

  function playCivicCard (cardId, discardCardIds = []) {
    assertPlaying(state)
    assertPhase(turnManager, 'build')
    const index = state.hand.findIndex(card => card.id === cardId)
    if (index === -1) throw new Error(`Card "${cardId}" is not in hand`)

    const card = state.hand[index]
    if (card.type !== CARD_TYPES.CIVIC) throw new Error(`Card "${cardId}" is not a civic card`)

    state.hand.splice(index, 1)
    spendTreasury(state, effectiveCost(state, card))
    resolveTrigger(card, 'onPlay', { ...context, cardIds: discardCardIds })
    // `exhaust` cards (Tourists, Commuters...) are spent: gone after one play.
    if (!card.exhaust) addToDiscardPile(state.deck, [card])
    return card
  }

  function acquireCard (cardId) {
    assertPlaying(state)
    assertPhase(turnManager, 'acquire')
    const inRow = cityRow.cards.find(c => c.id === cardId)
    const card = inRow ?? supply.find(c => c.id === cardId)
    if (!card) throw new Error(`Card "${cardId}" is not in the city row`)
    if ((state.buys ?? 0) < 1) throw new Error('No buys left this turn')
    // The market charges a card's PRICE; its cost is paid again to build it.
    spendTreasury(state, marketPrice(state, card)) // Bulk Buying takes 1 off
    if (inRow) acquireFromRow(cityRow, cardId) // a supply card (Roads) never runs out
    addToDiscardPile(state.deck, [card])
    state.buys -= 1
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
    log.push(`Goal claimed: ${goal.name}. It is a Monument in your deck now: build it once and it's gone.`)
    return goal
  }

  /** Trash a status card from the hand into a facility with a free slot (build phase). */
  function clearStatus (cardId) {
    assertPlaying(state)
    assertPhase(turnManager, 'build')
    const instance = clearStatusCard(state, cardId)
    log.push(`${instance.card.name} took a ${catalog[cardId]?.name ?? cardId} card out of your deck.`)
    resolveTrigger(instance.card, 'onClear', { ...context, instanceId: instance.instanceId })
    const reward = policyMod(state, 'clearReward') // Recycling Mandate
    if (reward) { addTreasury(state, reward); log.push(`+${reward} budget (Recycling Mandate).`) }
    return instance
  }

  /** Choose one of the offered mandates for this era. */
  function chooseMandate (mandateId) {
    return chooseRunMandate(context, mandateId)
  }

  /** Hold the election now (the mandate must already be met). */
  function callElection () {
    assertPhase(turnManager, 'acquire')
    return callRunElection(context)
  }

  /** After winning a run: keep building, no patience, no mandates. */
  function keepBuilding () {
    return goEndless(context)
  }

  /**
   * Combine two buildings in hand (cards/combine.js): pay, both leave the
   * deck for good, and option `choice` (0 or 1) of combineOptions goes to
   * the discard pile. Build phase only. Returns the new card.
   */
  function combineCards (cardIdA, cardIdB, choice = 0) {
    assertPlaying(state)
    assertPhase(turnManager, 'build')
    const ia = state.hand.findIndex(c => c.id === cardIdA)
    const ib = state.hand.findIndex((c, i) => c.id === cardIdB && i !== ia)
    if (ia === -1 || ib === -1) throw new Error('Both cards must be in your hand')
    const a = state.hand[ia]
    const b = state.hand[ib]
    if (!canCombine(a) || !canCombine(b)) throw new Error('Only buildings combine (not Roads or one-of-a-kinds)')
    if (!canCombinePair(a, b)) throw new Error('Only buildings the same size combine: two singles, two pairs, two Quarters...')
    const cost = Math.max(0, combineCost(a, b) - policyMod(state, 'combineDiscount')) // Zoning Reform
    if (state.treasury < cost) throw new Error(`Combining costs ${cost} budget`)
    const made = combineOptions(a, b, catalog)[choice]
    if (!made) throw new Error(`No option ${choice}`)
    spendTreasury(state, cost)
    for (const i of [ia, ib].sort((x, y) => y - x)) state.hand.splice(i, 1)
    if (!catalog[made.id]) catalog[made.id] = made
    addToDiscardPile(state.deck, [made])
    log.push(`Combined ${a.name} and ${b.name} into ${made.name}.`)
    return made
  }

  /** Buy the policy for sale beside the city row (acquire phase; budget, not a buy). */
  function buyPolicy () {
    assertPlaying(state)
    assertPhase(turnManager, 'acquire')
    const policy = state.policyForSale
    if (!policy) throw new Error('No policy for sale')
    const price = policyPrice(state)
    if (state.treasury < price) throw new Error(`${policy.name} costs ${price} budget`)
    spendTreasury(state, price)
    state.policies = [...(state.policies ?? []), policy]
    state.policyForSale = null // the next goes up when the next era opens
    log.push(`Policy bought: ${policy.name}.`)
    return policy
  }

  function advance () {
    return advancePhase(turnManager, context)
  }

  return {
    state,
    cityRow,
    goalRow,
    supply,
    turnManager,
    catalog,
    log,
    actions: { playCard, playCivicCard, combineCards, buyPolicy, choosePolicy: (id) => chooseRunPolicy(context, id), acquireCard, claimGoal, clearStatus, chooseMandate, callElection, keepBuilding, advance }
  }
}
