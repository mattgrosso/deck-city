import { describe, it, expect } from 'vitest'
import {
  createCityGrid,
  isInBounds,
  isCellEmpty,
  placeInstance,
  findFirstEmptyCell,
  instanceAt
} from './cityGrid'

describe('createCityGrid', () => {
  it('creates an empty grid of the given size', () => {
    const grid = createCityGrid({ width: 3, height: 2 })
    expect(grid.width).toBe(3)
    expect(grid.height).toBe(2)
    expect(grid.cells).toEqual(Array(6).fill(null))
  })

  it('defaults to DEFAULT_CITY_GRID_SIZE', () => {
    const grid = createCityGrid()
    expect(grid.width).toBe(6)
    expect(grid.height).toBe(4)
  })
})

describe('isInBounds', () => {
  const grid = createCityGrid({ width: 3, height: 2 })

  it('is true within bounds', () => {
    expect(isInBounds(grid, 0, 0)).toBe(true)
    expect(isInBounds(grid, 2, 1)).toBe(true)
  })

  it('is false outside bounds', () => {
    expect(isInBounds(grid, -1, 0)).toBe(false)
    expect(isInBounds(grid, 3, 0)).toBe(false)
    expect(isInBounds(grid, 0, 2)).toBe(false)
  })
})

describe('isCellEmpty / placeInstance / instanceAt', () => {
  it('an empty grid is empty everywhere in bounds and not empty out of bounds', () => {
    const grid = createCityGrid({ width: 2, height: 2 })
    expect(isCellEmpty(grid, 0, 0)).toBe(true)
    expect(isCellEmpty(grid, 5, 5)).toBe(false)
  })

  it('placeInstance occupies a cell, readable via instanceAt', () => {
    const grid = createCityGrid({ width: 2, height: 2 })
    placeInstance(grid, 1, 0, 'road#0')
    expect(isCellEmpty(grid, 1, 0)).toBe(false)
    expect(instanceAt(grid, 1, 0)).toBe('road#0')
    expect(instanceAt(grid, 0, 0)).toBeUndefined()
  })

  it('throws when placing on an already-occupied cell', () => {
    const grid = createCityGrid({ width: 2, height: 2 })
    placeInstance(grid, 0, 0, 'road#0')
    expect(() => placeInstance(grid, 0, 0, 'road#1')).toThrow(/not empty/)
  })

  it('throws when placing out of bounds', () => {
    const grid = createCityGrid({ width: 2, height: 2 })
    expect(() => placeInstance(grid, 9, 9, 'road#0')).toThrow(/not empty/)
  })

  it('instanceAt returns undefined out of bounds', () => {
    const grid = createCityGrid({ width: 2, height: 2 })
    expect(instanceAt(grid, 9, 9)).toBeUndefined()
  })
})

describe('findFirstEmptyCell', () => {
  it('returns the first empty cell in row-major order', () => {
    const grid = createCityGrid({ width: 2, height: 2 })
    placeInstance(grid, 0, 0, 'road#0')
    expect(findFirstEmptyCell(grid)).toEqual({ x: 1, y: 0 })
  })

  it('returns undefined when the grid is full', () => {
    const grid = createCityGrid({ width: 1, height: 1 })
    placeInstance(grid, 0, 0, 'road#0')
    expect(findFirstEmptyCell(grid)).toBeUndefined()
  })
})
