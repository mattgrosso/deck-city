import { describe, it, expect } from 'vitest'
import { createGame } from '../index'
import { runGameOptions, RUN } from '../../runSetup'

// The run: eras, mandates, Public Patience and elections (Matt, 2026-10-29).
function newRun () {
  const game = createGame(runGameOptions())
  game.actions.advance() // deal the first hand
  return game
}
const endTurn = (game) => {
  if (game.turnManager.phases[game.turnManager.currentPhaseIndex].name === 'build') game.actions.advance()
  for (let i = 0; i < 4; i++) game.actions.advance()
}

describe('the run', () => {
  it('opens on a choice of two Era I mandates with full patience', () => {
    const { state } = newRun()
    expect(state.run.status).toBe('choosing')
    expect(state.run.offer).toHaveLength(2)
    expect(state.run.offer.every(m => m.era === 1)).toBe(true)
    expect(state.run.patience).toBe(RUN.eras[0].patience)
  })

  it('drains patience every turn, but civic pride never stops it below the floor', () => {
    const game = newRun()
    game.actions.chooseMandate(game.state.run.offer[0].id)
    game.state.builtStructures.push({ instanceId: 'x', card: { id: 'park-x', patience: 99 }, position: { x: 0, y: 0 } })
    const before = game.state.run.patience
    endTurn(game)
    const total = game.state.run.lastDrain.total
    // Pride cuts the drain to the floor; a turn already under it keeps its own (time alone is 1).
    expect(total).toBeGreaterThanOrEqual(RUN.drain.base)
    expect(total).toBeLessThanOrEqual(RUN.drain.floor)
    expect(game.state.run.patience).toBe(before - total)
  })

  it('an unmet mandate at zero patience loses the run', () => {
    const game = newRun()
    game.actions.chooseMandate(game.state.run.offer[0].id)
    game.state.run.patience = 1
    endTurn(game)
    expect(game.state.run.status).toBe('lost')
    expect(game.state.run.election.passed).toBe(false)
    expect(game.state.gameStatus).toBe('lost')
  })

  it('a met mandate called early opens the next era, widens the limits and carries half the patience', () => {
    const game = newRun()
    const run = game.state.run
    game.actions.chooseMandate(run.offer[0].id)
    run.mandate = { ...run.mandate, condition: { type: 'populationAtLeast', amount: 1 } }
    game.actions.advance() // build -> acquire
    expect(() => game.actions.callElection()).not.toThrow()
    expect(run.era).toBe(2)
    expect(run.status).toBe('choosing')
    expect(run.patienceStart).toBe(RUN.eras[1].patience + Math.floor(RUN.eras[0].patience / 2))
    expect(game.state.cityGrid.limits).toEqual(RUN.eras[1].limits)
  })

  it('refuses an early election before the mandate is met', () => {
    const game = newRun()
    game.actions.chooseMandate(game.state.run.offer[0].id)
    game.actions.advance()
    expect(() => game.actions.callElection()).toThrow(/not met/)
  })

  it('winning the third era offers an endless city', () => {
    const game = newRun()
    const run = game.state.run
    for (let era = 1; era <= 3; era++) {
      game.actions.chooseMandate(run.offer[0].id)
      run.mandate = { ...run.mandate, condition: { type: 'populationAtLeast', amount: 1 } }
      run.patience = 1
      endTurn(game)
    }
    expect(run.status).toBe('won')
    game.actions.keepBuilding()
    expect(run.status).toBe('endless')
    expect(game.state.gameStatus).toBe('playing')
  })

  it('sells Roads from the supply without using up the supply', () => {
    const game = newRun()
    game.actions.chooseMandate(game.state.run.offer[0].id)
    game.actions.advance()
    game.state.treasury = 5
    game.actions.acquireCard('road')
    expect(game.supply.map(c => c.id)).toEqual(['road', 'police-station', 'fire-station', 'clinic', 'sanitation-center'])
    expect(game.cityRow.sourceDeck.drawPile.concat(game.cityRow.cards).some(c => c.id === 'police-station')).toBe(false)
    expect(game.state.deck.discardPile.some(c => c.id === 'road')).toBe(true)
    expect(game.state.buys).toBe(0)
  })

  it('shuffles the starting deck, so the opening hand changes from game to game', () => {
    const hands = new Set()
    for (let i = 0; i < 20; i++) hands.add(newRun().state.hand.map(c => c.id).sort().join(','))
    expect(hands.size).toBeGreaterThan(1)
  })
})
