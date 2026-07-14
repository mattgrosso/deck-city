// The spatial grid buildings get placed on. Plain data + functions, same
// style as the rest of the engine — cells hold an instanceId (or null),
// never the card/instance itself, so the grid stays a thin index rather
// than a second source of truth for building data.

export const DEFAULT_CITY_GRID_SIZE = { width: 6, height: 4 }

/**
 * @param {Object} [options]
 * @param {number} [options.width]
 * @param {number} [options.height]
 */
export function createCityGrid ({ width, height } = DEFAULT_CITY_GRID_SIZE) {
  return { width, height, cells: Array(width * height).fill(null) }
}

function indexOf (grid, x, y) {
  return y * grid.width + x
}

export function isInBounds (grid, x, y) {
  return x >= 0 && x < grid.width && y >= 0 && y < grid.height
}

export function isCellEmpty (grid, x, y) {
  return isInBounds(grid, x, y) && grid.cells[indexOf(grid, x, y)] === null
}

/**
 * @param {Object} grid
 * @param {number} x
 * @param {number} y
 * @param {string} instanceId
 */
export function placeInstance (grid, x, y, instanceId) {
  if (!isCellEmpty(grid, x, y)) {
    throw new Error(`Cell (${x}, ${y}) is not empty`)
  }
  grid.cells[indexOf(grid, x, y)] = instanceId
}

/** @returns {{x: number, y: number}|undefined} */
export function findFirstEmptyCell (grid) {
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (isCellEmpty(grid, x, y)) return { x, y }
    }
  }
  return undefined
}

/** @returns {string|undefined} the instanceId at (x, y), if any */
export function instanceAt (grid, x, y) {
  return isInBounds(grid, x, y) ? grid.cells[indexOf(grid, x, y)] ?? undefined : undefined
}
