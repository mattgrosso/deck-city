import { describe, it, expect } from 'vitest'
import { createCityGrid, isCellEmpty } from './cityGrid'
import { generateTerrain, isWater } from './terrain'
import { createGame, calcStatTotal } from '../index'
import { runGameOptions, GRID } from '@/game/runSetup'

const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
const DRY = { x0: 9, y0: 5, x1: 15, y1: 11 }
const FIRST = { x0: 6, y0: 4, x1: 18, y1: 12 }

describe('terrain', () => {
  it('lays a different map each game, never on the town, a pond at most in the first era', () => {
    const maps = new Set()
    for (let s = 1; s <= 40; s++) {
      const grid = createCityGrid(GRID)
      generateTerrain(grid, seeded(s), { dry: DRY, firstEra: FIRST })
      maps.add(grid.terrain.join())
      let wet = 0; let firstEra = 0
      for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
          if (!isWater(grid, x, y)) continue
          wet++
          expect(x >= DRY.x0 && x < DRY.x1 && y >= DRY.y0 && y < DRY.y1).toBe(false)
          if (x >= FIRST.x0 && x < FIRST.x1 && y >= FIRST.y0 && y < FIRST.y1) firstEra++
        }
      }
      expect(wet).toBeGreaterThan(0)
      expect(firstEra).toBeLessThanOrEqual(10)
      expect(wet).toBeLessThan(grid.width * grid.height * 0.3)
    }
    expect(maps.size).toBeGreaterThan(30)
  })

  it('water is never free land', () => {
    const grid = createCityGrid({ width: 4, height: 4 })
    grid.terrain[5] = 'water'
    expect(isCellEmpty(grid, 1, 1)).toBe(false)
    expect(isCellEmpty(grid, 2, 1)).toBe(true)
  })

  it('a home on the waterfront houses one more', () => {
    const game = createGame({ ...runGameOptions({ rng: seeded(3) }), terrain: null })
    const before = calcStatTotal(game.state, 'population')
    game.state.cityGrid.terrain[6 * game.state.cityGrid.width + 11] = 'water' // just north of the house at (11, 7)
    expect(calcStatTotal(game.state, 'population')).toBe(before + 1)
  })
})

describe('multi-tile buildings', () => {
  const setup = () => {
    const game = createGame({ ...runGameOptions({ rng: seeded(5) }), terrain: null })
    game.actions.advance()
    game.actions.chooseMandate(game.state.run.offer[0].id)
    game.state.treasury = 99
    return game
  }
  it('covers every cell, turned; counts neighbours on all of them; streets cannot cut it', async () => {
    const { footprint, cellsOf, getAdjacentInstances, listConnectedEdges, placementProblem } = await import('../index')
    const game = setup()
    const s = game.state
    const school = game.catalog.school
    expect(footprint(school, { x: 11, y: 8 }, 1)).toEqual([{ x: 11, y: 8 }, { x: 11, y: 9 }])
    expect(placementProblem(s, school, { x: 11, y: 8 }, 0)).toMatch(/in the way/) // (12, 8) has the factory
    s.hand.push(school)
    const inst = game.actions.playCard('school', { x: 11, y: 8, rotation: 1 })
    expect(cellsOf(inst)).toHaveLength(2)
    expect(s.cityGrid.cells[9 * s.cityGrid.width + 11]).toBe(inst.instanceId)
    // Touches the house above and the factory beside its top cell.
    expect(getAdjacentInstances(s, inst.instanceId).map(i => i.card.id).sort()).toEqual(['industrial', 'residential'])
    expect(listConnectedEdges(s.cityGrid).some(e => e.key === 'h:11,9')).toBe(false)
  })
  it('needs a street beside one of its cells, and none through it', async () => {
    const { placementProblem } = await import('../index')
    const game = setup()
    const s = game.state
    expect(placementProblem(s, game.catalog.school, { x: 11, y: 10 }, 0)).toMatch(/road access/)
    s.cityGrid.roads.add('v:12,10')
    expect(placementProblem(s, game.catalog.school, { x: 11, y: 10 }, 0)).toMatch(/street runs through/)
  })
})
