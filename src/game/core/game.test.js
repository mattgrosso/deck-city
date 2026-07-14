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
  effects: { onPlay: [{ type: 'discardCards' }, { type: 'drawCards', amount: 2 }] }
}

describe('createGame', () => {
  it('drives one full turn using only the example cards', () => {
    // No rng is passed, and createDeck never shuffles on creation, so the
    // starting deck's draw order is just its input array consumed from the
    // end — i.e. drawing 3 from ['road', 'residential', 'clinic'] yields
    // clinic, then residential, then road.
    const game = createGame({
      cardCatalog: EXAMPLE_CARDS,
      startingDeckCardIds: ['road', 'residential', 'clinic'],
      treasury: 10,
      handSize: 3
    })

    // 'draw' phase runs and populates the hand; current phase becomes 'build'.
    game.actions.advance()
    expect(game.state.hand.map(card => card.id)).toEqual(['clinic', 'residential', 'road'])

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
    // 'endOfTurn' tallies revenue and ticks the disaster timer -> current phase becomes 'cleanup'.
    game.actions.advance()
    expect(game.state.treasury).toBe(10 - RESIDENTIAL.cost + RESIDENTIAL.stats.revenue)
    expect(game.state.disasterTimer.turnsUntilDeadline).toBe(3)

    // 'cleanup' discards the remaining hand -> wraps back to 'draw', turnNumber becomes 1.
    game.actions.advance()
    expect(game.state.hand).toEqual([])
    expect(game.turnManager.turnNumber).toBe(1)
  })

  it('rejects playing a card outside the build phase', () => {
    const game = createGame({ cardCatalog: EXAMPLE_CARDS, startingDeckCardIds: ['road'] })
    expect(() => game.actions.playCard('road')).toThrow(/requires phase "build"/)
  })

  it('rejects acquiring a card outside the acquire phase', () => {
    const game = createGame({ cardCatalog: EXAMPLE_CARDS, cityDeckCardIds: ['road'] })
    expect(() => game.actions.acquireCard('road')).toThrow(/requires phase "acquire"/)
  })

  it('rejects building without a position', () => {
    const game = createGame({ cardCatalog: EXAMPLE_CARDS, startingDeckCardIds: ['road'] })
    game.actions.advance() // draw -> build
    expect(() => game.actions.playCard('road')).toThrow(/Invalid or occupied cell/)
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

  it('lets a road card be placed on any empty cell, ignoring the frontage rule', () => {
    const game = createGame({ cardCatalog: [ROAD_CARD], startingDeckCardIds: ['test-road'], treasury: 5 })
    game.actions.advance() // draw -> build
    game.actions.playCard('test-road', { x: 0, y: 0 })
    expect(game.state.builtStructures).toEqual([]) // never occupies a cell
    expect(game.state.deck.discardPile.map(card => card.id)).toContain('test-road')
  })

  it('a placed road grants frontage to neighboring cells', () => {
    const game = createGame({
      cardCatalog: [ROAD_CARD, PLAIN_BUILDING_CARD],
      startingDeckCardIds: ['test-road', 'test-building'],
      handSize: 2,
      treasury: 5
    })
    game.actions.advance() // draw -> build

    // (0,0) is not one of the seeded starting-road cells, so before placing
    // a road there, its neighbor (1,0) has no frontage either.
    expect(() => game.actions.playCard('test-building', { x: 1, y: 0 })).toThrow(/no road access/)

    game.actions.playCard('test-road', { x: 0, y: 0 })
    game.actions.playCard('test-building', { x: 1, y: 0 })

    expect(game.state.builtStructures).toHaveLength(1)
    expect(game.state.builtStructures[0].position).toEqual({ x: 1, y: 0 })
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
        handSize: 5
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
})
