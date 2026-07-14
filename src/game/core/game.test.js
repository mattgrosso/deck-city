import { describe, it, expect } from 'vitest'
import { createGame } from './game'
import { EXAMPLE_CARDS, RESIDENTIAL } from './cards/exampleCards'

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

    // Legal because the current phase is 'build'.
    game.actions.playCard('residential')
    expect(game.state.builtStructures).toHaveLength(1)
    expect(game.state.builtStructures[0].card).toBe(RESIDENTIAL)
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
})
