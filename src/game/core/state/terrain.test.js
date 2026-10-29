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
