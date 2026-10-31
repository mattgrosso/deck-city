import { describe, it, expect } from 'vitest'
import { createGame } from './game'
import { EXAMPLE_CARDS, RESIDENTIAL } from './cards/exampleCards'
import { CARD_TYPES } from './cards/cardSchema'
import { DEFAULT_STARTING_ROAD_CELLS } from './state/cityGrid'

// A new game seeds road frontage at DEFAULT_STARTING_ROAD_CELLS (see
// cityGrid.js) — tests that build a plain (non-road) card target one of
// those cells so the road-frontage requirement is already satisfied.
const [BUILDABLE_CELL] = DEFAULT_STARTING_ROAD_CELLS

const ROAD_CARD = { id: 'test-road', type: CARD_TYPES.BUILDING, name: 'Test Road', cost: 1, placesRoad: true }
const PLAIN_BUILDING_CARD = { id: 'test-building', type: CARD_TYPES.BUILDING, name: 'Test Building', cost: 1 }
const CIVIC_CARD = {
  id: 'test-civic', type: CARD_TYPES.CIVIC, name: 'Test Civic', cost: 0,
  effects: { onPlay: [{ type: 'discardCards', amount: 2 }, { type: 'drawCards', amount: 2 }] }
}

describe('createGame', () => {
  it('drives one full turn using only the example cards', () => {
    // shuffleStartingDeck: false deals in list order, so the
    // starting deck's draw order is just its input array consumed from the
    // end — i.e. drawing 3 from ['road', 'residential', 'clinic'] yields
    // clinic, then residential, then road.
    //
    // baseRevenue: 10 (rather than the engine default of 4) keeps this
    // test's numbers matching its original "start with 10" intent — budget
    // resets to building revenue + baseRevenue every 'draw' phase (see
    // turn/phases.js), overwriting the `treasury` option's initial value
    // the moment the first 'draw' runs.
    const game = createGame({
      cardCatalog: EXAMPLE_CARDS,
      startingDeckCardIds: ['road', 'residential', 'clinic'],
      baseRevenue: 10,
      handSize: 3,
      shuffleStartingDeck: false
    })

    // 'draw' phase runs (budget resets to 10, hand is populated); current
    // phase becomes 'build'.
    game.actions.advance()
    expect(game.state.hand.map(card => card.id)).toEqual(['clinic', 'residential', 'road'])
    expect(game.state.treasury).toBe(10)

    // Legal because the current phase is 'build', and BUILDABLE_CELL already
    // has road frontage from the game's starting seed.
    game.actions.playCard('residential', BUILDABLE_CELL)
    expect(game.state.builtStructures).toHaveLength(1)
    expect(game.state.builtStructures[0].card).toBe(RESIDENTIAL)
    expect(game.state.builtStructures[0].position).toEqual(BUILDABLE_CELL)
    expect(game.state.hand.map(card => card.id)).toEqual(['clinic', 'road'])
    expect(game.state.deck.discardPile.map(card => card.id)).toEqual(
      expect.arrayContaining(['residential', 'crime'])
    )
    expect(game.state.treasury).toBe(10 - RESIDENTIAL.cost)

    // 'build' (no-op) -> current phase becomes 'acquire'.
    game.actions.advance()
    // 'acquire' (no-op, nothing in an empty city row) -> current phase becomes 'endOfTurn'.
    game.actions.advance()
    // 'endOfTurn' ticks the disaster timer; budget resets happen in 'draw',
    // not here, so treasury is untouched -> current phase becomes 'cleanup'.
    game.actions.advance()
    expect(game.state.treasury).toBe(10 - RESIDENTIAL.cost)
    expect(game.state.disasterTimer.turnsUntilDeadline).toBe(3)

    // 'cleanup' discards the remaining hand -> wraps back to 'draw', turnNumber becomes 1.
    game.actions.advance()
    expect(game.state.hand).toEqual([])
    expect(game.turnManager.turnNumber).toBe(1)

    // Turn 2's 'draw' phase now sees the Residential built last turn: its
    // +1 revenue and baseRevenue land on top of what was saved.
    game.actions.advance()
    expect(game.state.treasury).toBe(10 - RESIDENTIAL.cost + 10 + RESIDENTIAL.stats.revenue)
  })

  it('rejects playing a card outside the build phase', () => {
    const game = createGame({ cardCatalog: EXAMPLE_CARDS, startingDeckCardIds: ['road'] })
    expect(() => game.actions.playCard('road')).toThrow(/requires phase "build"/)
  })

  it('rejects acquiring a card outside the acquire phase', () => {
    const game = createGame({ cardCatalog: EXAMPLE_CARDS, cityDeckCardIds: ['road'] })
    expect(() => game.actions.acquireCard('road')).toThrow(/requires phase "acquire"/)
  })

  it('with no spot named, the city picks one beside a street (state/autoPlace.js)', () => {
    const game = createGame({ cardCatalog: EXAMPLE_CARDS, startingDeckCardIds: ['road'] })
    game.actions.advance() // draw -> build
    const built = game.actions.playCard('road')
    expect(game.state.builtStructures).toHaveLength(1)
    expect(built.position).toBeTruthy()
  })

  it('rejects building onto an already-occupied cell', () => {
    const game = createGame({
      cardCatalog: EXAMPLE_CARDS, startingDeckCardIds: ['road', 'road'], handSize: 2, treasury: 5
    })
    game.actions.advance() // draw -> build
    game.actions.playCard('road', BUILDABLE_CELL)
    expect(() => game.actions.playCard('road', BUILDABLE_CELL)).toThrow(/Invalid or occupied cell/)
  })

  it('rejects building a non-road card onto a cell with no road frontage', () => {
    const game = createGame({ cardCatalog: EXAMPLE_CARDS, startingDeckCardIds: ['road'], treasury: 5 })
    game.actions.advance() // draw -> build
    expect(() => game.actions.playCard('road', { x: 0, y: 0 })).toThrow(/no road access/)
  })

  it('lays one or two street segments that touch the network, never on a cell', () => {
    const game = createGame({ cardCatalog: [ROAD_CARD], startingDeckCardIds: ['test-road'], treasury: 5 })
    game.actions.advance() // draw -> build
    expect(() => game.actions.playCard('test-road', { x: 0, y: 0 })).toThrow(/lays 1 to 2 segments/)
    expect(() => game.actions.playCard('test-road', { edge: 'h:5,4' })).toThrow(/already has a road/)
    expect(() => game.actions.playCard('test-road', { edge: 'h:0,0' })).toThrow(/does not touch a street/)
    // Two segments: the first touches the starting street, the second touches the first.
    game.actions.playCard('test-road', { edges: ['h:7,4', 'h:8,4'] })
    expect(game.state.cityGrid.roads.has('h:7,4')).toBe(true)
    expect(game.state.cityGrid.roads.has('h:8,4')).toBe(true)
    expect(game.state.builtStructures).toEqual([]) // never occupies a cell
    expect(game.state.deck.discardPile.filter(card => card.id === 'test-road')).toHaveLength(1) // one card, not two
  })

  it('a placed road grants frontage to neighboring cells', () => {
    const game = createGame({
      cardCatalog: [ROAD_CARD, PLAIN_BUILDING_CARD],
      startingDeckCardIds: ['test-road', 'test-building'],
      handSize: 2,
      treasury: 5
    })
    game.actions.advance() // draw -> build

    // (7,4) is just east of the starting street's end; it has no frontage yet.
    expect(() => game.actions.playCard('test-building', { x: 7, y: 4 })).toThrow(/no road access/)

    game.actions.playCard('test-road', { edge: 'h:7,4' }) // extends the starting street east
    game.actions.playCard('test-building', { x: 7, y: 4 })

    expect(game.state.builtStructures).toHaveLength(1)
    expect(game.state.builtStructures[0].position).toEqual({ x: 7, y: 4 })
  })

  describe('playCivicCard', () => {
    it('discards the named cards and draws replacements', () => {
      // 7 cards, hand size 5: draw() pops from the end, so putting
      // 'test-civic' last means it's drawn first, leaving 2 spare 'road'
      // cards in the draw pile for the civic card's redraw to pull from
      // (rather than immediately reshuffling the just-discarded ones back).
      const game = createGame({
        cardCatalog: [CIVIC_CARD, ...EXAMPLE_CARDS],
        startingDeckCardIds: ['road', 'road', 'road', 'road', 'road', 'road', 'test-civic'],
        handSize: 5,
        shuffleStartingDeck: false
      })
      game.actions.advance() // draw -> build

      const discardIds = game.state.hand.filter(card => card.id === 'road').map(card => card.id).slice(0, 2)
      const handSizeBefore = game.state.hand.length

      game.actions.playCivicCard('test-civic', discardIds)

      expect(game.state.hand).toHaveLength(handSizeBefore - 1) // -1 civic, -2 discarded, +2 drawn
      expect(game.state.deck.discardPile.map(card => card.id)).toEqual(
        expect.arrayContaining(['test-civic', 'road', 'road'])
      )
    })

    it('rejects a non-civic card', () => {
      const game = createGame({ cardCatalog: EXAMPLE_CARDS, startingDeckCardIds: ['road'] })
      game.actions.advance() // draw -> build
      expect(() => game.actions.playCivicCard('road', [])).toThrow(/is not a civic card/)
    })

    it('rejects playing a civic card outside the build phase', () => {
      const game = createGame({ cardCatalog: [CIVIC_CARD], startingDeckCardIds: ['test-civic'] })
      expect(() => game.actions.playCivicCard('test-civic', [])).toThrow(/requires phase "build"/)
    })
  })

  describe('buys', () => {
    it('allows one buy a turn; a gainBuys card adds another; the count resets at the draw', () => {
      const SHOP = { id: 'shop', type: CARD_TYPES.BUILDING, name: 'Shop', cost: 3, price: 1 }
      const FAIR = { id: 'fair', type: CARD_TYPES.CIVIC, name: 'Fair', cost: 0, effects: { onPlay: [{ type: 'gainBuys', amount: 1 }] } }
      const game = createGame({ cardCatalog: [SHOP, FAIR], startingDeckCardIds: ['fair'], cityDeckCardIds: ['shop', 'shop', 'shop', 'shop', 'shop'], treasury: 9 })
      game.actions.advance() // draw -> build
      game.state.treasury = 9
      game.actions.playCivicCard('fair')
      game.actions.advance() // build -> acquire
      game.state.week = 4 // the market's week
      game.actions.acquireCard('shop')
      game.actions.acquireCard('shop')
      expect(() => game.actions.acquireCard('shop')).toThrow(/No buys left/)
      expect(game.state.treasury).toBe(7) // the price, not the build cost
      for (let i = 0; i < 4; i++) game.actions.advance() // round to the next build
      expect(game.state.buys).toBe(1)
    })
  })

  it('goes back from the market to building', () => {
    const game = createGame({ cardCatalog: EXAMPLE_CARDS, startingDeckCardIds: ['road'] })
    game.actions.advance() // draw -> build
    game.actions.advance() // build -> acquire
    game.actions.backToBuild()
    expect(game.turnManager.phases[game.turnManager.currentPhaseIndex].name).toBe('build')
  })

  describe('claimGoal', () => {
    const EASY_GOAL = {
      id: 'goal-easy', type: CARD_TYPES.GOAL, name: 'Easy Goal', tier: 1, cost: 0,
      skipsRoadRequirement: true, stats: {}, condition: { type: 'treasuryAtLeast', amount: 0 }
    }
    const HARD_GOAL = {
      id: 'goal-hard', type: CARD_TYPES.GOAL, name: 'Hard Goal', tier: 1, cost: 0,
      skipsRoadRequirement: true, stats: {}, condition: { type: 'treasuryAtLeast', amount: 999 }
    }

    it('claims a goal whose condition is met, for free, moving it to the discard pile', () => {
      const game = createGame({ cardCatalog: EXAMPLE_CARDS, goalDeckCardIds: ['road'] }) // unused catalog card just to exercise the row
      game.goalRow.cards = [EASY_GOAL]
      game.goalRow.timers = [4]
      game.actions.advance() // draw -> build
      game.actions.advance() // build -> acquire
      const treasuryBefore = game.state.treasury

      const claimed = game.actions.claimGoal('goal-easy')

      expect(claimed).toBe(EASY_GOAL)
      expect(game.state.treasury).toBe(treasuryBefore) // free — the condition is the price, not treasury
      expect(game.goalRow.cards).not.toContain(EASY_GOAL)
      expect(game.state.deck.discardPile).toContain(EASY_GOAL)
    })

    it('allows one claim a turn', () => {
      const game = createGame({ cardCatalog: EXAMPLE_CARDS })
      const SECOND = { ...EASY_GOAL, id: 'goal-easy-2', name: 'Second Goal' }
      game.goalRow.cards = [EASY_GOAL, SECOND]
      game.goalRow.timers = [4, 4]
      game.actions.advance() // draw -> build
      game.actions.advance() // build -> acquire
      game.actions.claimGoal('goal-easy')
      expect(() => game.actions.claimGoal('goal-easy-2')).toThrow(/one goal/)
    })

    it('rejects claiming a goal whose condition is not yet met', () => {
      const game = createGame({ cardCatalog: EXAMPLE_CARDS })
      game.goalRow.cards = [HARD_GOAL]
      game.goalRow.timers = [4]
      game.actions.advance() // draw -> build
      game.actions.advance() // build -> acquire

      expect(() => game.actions.claimGoal('goal-hard')).toThrow(/condition is not yet met/)
      expect(game.goalRow.cards).toContain(HARD_GOAL)
    })

    it('rejects claiming outside the acquire phase', () => {
      const game = createGame({ cardCatalog: EXAMPLE_CARDS })
      game.goalRow.cards = [EASY_GOAL]
      game.goalRow.timers = [4]
      expect(() => game.actions.claimGoal('goal-easy')).toThrow(/requires phase "acquire"/)
    })

    it('a claimed goal is buildable as a monument, skipping the road-frontage requirement', () => {
      const game = createGame({ cardCatalog: EXAMPLE_CARDS })
      game.goalRow.cards = [EASY_GOAL]
      game.goalRow.timers = [4]
      game.actions.advance() // runs draw -> now in 'build'
      game.actions.advance() // runs build (no-op) -> now in 'acquire'
      game.actions.claimGoal('goal-easy')
      // Cycle all the way back around to 'build' before touching hand
      // directly - 'cleanup' (run by the 3rd advance below) would discard
      // anything pushed into hand before it runs.
      game.actions.advance() // runs acquire (no-op) -> now in 'endOfTurn'
      game.actions.advance() // runs endOfTurn -> now in 'cleanup'
      game.actions.advance() // runs cleanup (empty hand, harmless) -> now in 'draw'
      game.actions.advance() // runs draw (empty deck, harmless) -> now in 'build'
      game.state.hand.push(EASY_GOAL) // simulate drawing the claimed monument

      // (0, 0) deliberately has no road frontage.
      const instance = game.actions.playCard('goal-easy', { x: 0, y: 0 })

      expect(instance.card).toBe(EASY_GOAL)
      expect(instance.position).toEqual({ x: 0, y: 0 })
    })
  })

  describe('game-over guards', () => {
    it('blocks playCard, playCivicCard, acquireCard, and claimGoal once the game has ended', () => {
      const game = createGame({ cardCatalog: EXAMPLE_CARDS, startingDeckCardIds: ['road'] })
      game.actions.advance() // draw -> build
      game.state.gameStatus = 'won'

      expect(() => game.actions.playCard('road', BUILDABLE_CELL)).toThrow(/already over/)
      expect(() => game.actions.playCivicCard('road', [])).toThrow(/already over/)
      expect(() => game.actions.acquireCard('road')).toThrow(/already over/)
      expect(() => game.actions.claimGoal('road')).toThrow(/already over/)
    })

    it('does not block phase advancement once the game has ended', () => {
      const game = createGame({ cardCatalog: EXAMPLE_CARDS })
      game.state.gameStatus = 'lost'
      expect(() => game.actions.advance()).not.toThrow()
    })
  })

  describe('win/lose integration', () => {
    it('wins once a built structure pushes population to the target', () => {
      const POPULATION_CARD = { id: 'tower', type: CARD_TYPES.BUILDING, name: 'Tower', cost: 0, stats: { population: 20 } }
      const game = createGame({
        cardCatalog: [POPULATION_CARD], startingDeckCardIds: ['tower'], populationTarget: 20
      })
      game.actions.advance() // runs draw -> now in 'build'
      game.actions.playCard('tower', BUILDABLE_CELL)
      game.actions.advance() // runs build (no-op) -> now in 'acquire'
      game.actions.advance() // runs acquire (no-op) -> now in 'endOfTurn'
      game.actions.advance() // runs endOfTurn, which checks the win condition

      expect(game.state.gameStatus).toBe('won')
    })

    it('loses once the goal deck and row are both exhausted with no win yet', () => {
      const game = createGame({ cardCatalog: EXAMPLE_CARDS, goalDeckCardIds: ['road'], goalRowSize: 1 })
      // Claim (well, just drain) the row by hand rather than playing out
      // real turns — what matters here is the deck+row both ending empty.
      game.goalRow.cards = []
      game.goalRow.sourceDeck.drawPile = []
      game.goalRow.sourceDeck.discardPile = []

      game.actions.advance() // runs draw -> now in 'build'
      game.actions.advance() // runs build (no-op) -> now in 'acquire'
      game.actions.advance() // runs acquire (no-op) -> now in 'endOfTurn'
      game.actions.advance() // runs endOfTurn, which checks the lose condition

      expect(game.state.gameStatus).toBe('lost')
    })
  })
})

describe('monuments', () => {
  it('a claimed goal is built once, then gone from the deck', async () => {
    const { runGameOptions } = await import('@/game/runSetup')
    const game = createGame({ ...runGameOptions(), terrain: null })
    game.actions.advance()
    const s = game.state
    game.actions.chooseMandate(s.run.offer[0].id)
    const monument = { ...game.goalRow.cards[0] }
    s.hand.push(monument)
    s.treasury = 50
    game.actions.playCard(monument.id, { x: 11, y: 8, rotation: 1 }) // two plots, turned to run south
    const all = [...s.deck.drawPile, ...s.deck.discardPile, ...s.hand]
    expect(all.some(c => c.id === monument.id)).toBe(false)
    expect(s.builtStructures.some(i => i.card.id === monument.id)).toBe(true)
  })
})

describe('claiming a goal', () => {
  it('pays the reward printed on it: the budget now and, from tier II, a policy pick', async () => {
    const { runGameOptions } = await import('@/game/runSetup')
    const game = createGame({ ...runGameOptions(), terrain: null })
    game.actions.advance()
    const s = game.state
    game.actions.chooseMandate(s.run.offer[0].id)
    game.actions.choosePolicy(s.run.policyOffer[0].id)
    const goal = game.catalog['goal-school-district'] // tier II: +6 budget and a policy
    game.goalRow.cards.splice(0, 1, goal)
    s.builtStructures.push({ instanceId: 's#1', card: { id: 'school', type: 'building', tags: ['education'], stats: {} } }, { instanceId: 's#2', card: { id: 'school', type: 'building', tags: ['education'], stats: {} } })
    game.actions.advance() // to the acquire phase
    const before = s.treasury
    game.actions.claimGoal(goal.id)
    expect(s.treasury).toBe(before + 6)
    expect(s.run.policyOffer).toHaveLength(3)
  })
})

describe('a civic card that discards', () => {
  it('takes exactly as many cards as it says (Civic Works: two, not one)', () => {
    const game = createGame({ cardCatalog: [CIVIC_CARD, ...EXAMPLE_CARDS], startingDeckCardIds: ['road', 'road', 'test-civic'], handSize: 5, shuffleStartingDeck: false })
    game.actions.advance()
    expect(() => game.actions.playCivicCard('test-civic', ['road'])).toThrow(/needs 2/)
    expect(game.state.hand.map(c => c.id)).toContain('test-civic') // nothing happened
  })
})
