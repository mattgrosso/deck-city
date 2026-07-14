import { describe, it, expect } from 'vitest'
import {
  createCityGrid,
  isInBounds,
  isCellEmpty,
  placeInstance,
  findFirstEmptyCell,
  instanceAt,
  cellEdgeKeys,
  addRoadsAroundCell,
  hasRoadFrontage,
  isBuildable,
  listRoadEdges,
  seedStartingRoads
} from './cityGrid'

describe('createCityGrid', () => {
  it('creates an empty grid of the given size', () => {
    const grid = createCityGrid({ width: 3, height: 2 })
    expect(grid.width).toBe(3)
    expect(grid.height).toBe(2)
    expect(grid.cells).toEqual(Array(6).fill(null))
    expect(grid.roads.size).toBe(0)
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

describe('cellEdgeKeys', () => {
  it('neighboring cells share a key for their common edge', () => {
    // cell (0,0)'s right edge is the same key as cell (1,0)'s left edge
    expect(cellEdgeKeys(0, 0).right).toBe(cellEdgeKeys(1, 0).left)
    // cell (0,0)'s bottom edge is the same key as cell (0,1)'s top edge
    expect(cellEdgeKeys(0, 0).bottom).toBe(cellEdgeKeys(0, 1).top)
  })
})

describe('addRoadsAroundCell / hasRoadFrontage / isBuildable', () => {
  it('roads a cell without occupying it', () => {
    const grid = createCityGrid({ width: 3, height: 3 })
    addRoadsAroundCell(grid, 1, 1)
    expect(isCellEmpty(grid, 1, 1)).toBe(true)
    expect(hasRoadFrontage(grid, 1, 1)).toBe(true)
    expect(isBuildable(grid, 1, 1)).toBe(true)
  })

  it('gives the neighboring cell frontage too, via the shared edge', () => {
    const grid = createCityGrid({ width: 3, height: 3 })
    addRoadsAroundCell(grid, 1, 1)
    expect(hasRoadFrontage(grid, 2, 1)).toBe(true) // right neighbor
    expect(hasRoadFrontage(grid, 0, 1)).toBe(true) // left neighbor
    expect(hasRoadFrontage(grid, 1, 0)).toBe(true) // top neighbor
    expect(hasRoadFrontage(grid, 1, 2)).toBe(true) // bottom neighbor
  })

  it('a cell with no adjacent roads has no frontage and is not buildable', () => {
    const grid = createCityGrid({ width: 3, height: 3 })
    addRoadsAroundCell(grid, 1, 1)
    expect(hasRoadFrontage(grid, 0, 0)).toBe(false) // diagonal, no shared edge
    expect(isBuildable(grid, 0, 0)).toBe(false)
  })

  it('isBuildable is false out of bounds even with a matching key coincidentally in roads', () => {
    const grid = createCityGrid({ width: 2, height: 2 })
    expect(isBuildable(grid, 9, 9)).toBe(false)
  })
})

describe('listRoadEdges', () => {
  it('lists every roaded edge with its kind and coordinates', () => {
    const grid = createCityGrid({ width: 2, height: 2 })
    addRoadsAroundCell(grid, 0, 0)
    const edges = listRoadEdges(grid)
    expect(edges).toHaveLength(4)
    expect(edges).toEqual(expect.arrayContaining([
      { kind: 'h', x: 0, y: 0 },
      { kind: 'h', x: 0, y: 1 },
      { kind: 'v', x: 0, y: 0 },
      { kind: 'v', x: 1, y: 0 }
    ]))
  })
})

describe('seedStartingRoads', () => {
  it('roads the default starting cells and their neighbors', () => {
    const grid = createCityGrid()
    seedStartingRoads(grid)
    expect(isBuildable(grid, 2, 1)).toBe(true)
    expect(isBuildable(grid, 3, 1)).toBe(true)
    expect(isBuildable(grid, 1, 1)).toBe(true) // left neighbor
    expect(isBuildable(grid, 4, 1)).toBe(true) // right neighbor
  })

  it('accepts a custom list of cells', () => {
    const grid = createCityGrid({ width: 3, height: 3 })
    seedStartingRoads(grid, [{ x: 0, y: 0 }])
    expect(isBuildable(grid, 0, 0)).toBe(true)
    expect(isBuildable(grid, 2, 2)).toBe(false)
  })
})
