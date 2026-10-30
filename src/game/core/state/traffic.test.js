import { describe, it, expect } from 'vitest'
import { createGame, computeTraffic, tripsOf, jamDrain, LANE_CAPACITY } from '../index'
import { runGameOptions } from '@/game/runSetup'

const setup = () => {
  const game = createGame({ ...runGameOptions(), terrain: null })
  game.actions.advance()
  game.actions.chooseMandate(game.state.run.offer[0].id)
  return game
}

describe('traffic', () => {
  it('buildings make trips (half their people and jobs) that load the streets beside them', () => {
    const game = setup()
    const s = game.state
    const house = s.builtStructures.find(i => i.card.id === 'residential')
    expect(tripsOf(s, house)).toBe(Math.ceil((2 + 0) / 2))
    const t = computeTraffic(s)
    expect(t.trips).toBeGreaterThan(0)
    // The starting street carries all of the town's trips.
    const total = [...t.load.values()].reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(t.trips)
    expect(t.jammed).toEqual([])
  })

  it('a street over capacity jams and drains patience; lanes and transit carry more', () => {
    const game = setup()
    const s = game.state
    const key = [...s.cityGrid.roads][0]
    const big = { ...game.catalog['high-rise'], stats: { population: 40 } }
    s.builtStructures.push({ instanceId: 'big#1', card: big, position: { x: 11, y: 8 }, cells: [{ x: 11, y: 8 }] })
    s.cityGrid.cells[8 * s.cityGrid.width + 11] = 'big#1'
    let t = computeTraffic(s)
    expect(t.jammed.length).toBeGreaterThan(0)
    expect(jamDrain(s)).toBeGreaterThanOrEqual(1)
    s.cityGrid.lanes = Object.fromEntries([...s.cityGrid.roads].map(k => [k, 10]))
    t = computeTraffic(s)
    expect(t.jammed).toEqual([])
    expect(t.capacity.get(key)).toBe(10 * LANE_CAPACITY)
  })
})
