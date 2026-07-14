// The spatial grid buildings get placed on. Plain data + functions, same
// style as the rest of the engine — cells hold an instanceId (or null),
// never the card/instance itself, so the grid stays a thin index rather
// than a second source of truth for building data. Roads live on the grid
// too, but on the *edges* between cells rather than in a cell — a cell's
// "road frontage" is having a road on any of its 4 bordering edges, which
// is what makes it buildable (see isBuildable / hasRoadFrontage below).

export const DEFAULT_CITY_GRID_SIZE = { width: 6, height: 4 }

/**
 * @param {Object} [options]
 * @param {number} [options.width]
 * @param {number} [options.height]
 */
export function createCityGrid ({ width, height } = DEFAULT_CITY_GRID_SIZE) {
  return { width, height, cells: Array(width * height).fill(null), roads: new Set() }
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

function hEdgeKey (x, y) {
  return `h:${x},${y}` // the horizontal edge at column x, on the boundary above row y (y ranges 0..height)
}

function vEdgeKey (x, y) {
  return `v:${x},${y}` // the vertical edge at row y, on the boundary left of column x (x ranges 0..width)
}

/**
 * The 4 edge keys bordering cell (x, y). Shared edges between neighboring
 * cells resolve to the same key, so roading one cell gives its neighbor
 * frontage on that shared side too.
 */
export function cellEdgeKeys (x, y) {
  return {
    top: hEdgeKey(x, y),
    bottom: hEdgeKey(x, y + 1),
    left: vEdgeKey(x, y),
    right: vEdgeKey(x + 1, y)
  }
}

/**
 * Paints all 4 edges of a cell as roaded. The cell itself is untouched —
 * roads live on the border, not in the cell — so it stays buildable.
 * @param {Object} grid
 * @param {number} x
 * @param {number} y
 */
export function addRoadsAroundCell (grid, x, y) {
  Object.values(cellEdgeKeys(x, y)).forEach(key => grid.roads.add(key))
}

/** @returns {boolean} true if any of the cell's 4 edges has a road */
export function hasRoadFrontage (grid, x, y) {
  return Object.values(cellEdgeKeys(x, y)).some(key => grid.roads.has(key))
}

/** @returns {boolean} true if the cell is in bounds and has road frontage */
export function isBuildable (grid, x, y) {
  return isInBounds(grid, x, y) && hasRoadFrontage(grid, x, y)
}

/**
 * @param {Object} grid
 * @returns {{kind: 'h'|'v', x: number, y: number}[]} every roaded edge, for rendering
 */
export function listRoadEdges (grid) {
  return Array.from(grid.roads).map(key => {
    const [kind, coords] = key.split(':')
    const [x, y] = coords.split(',').map(Number)
    return { kind, x, y }
  })
}

/** Two adjacent squares, roaded on every side, so a new game has somewhere legal to build. */
export const DEFAULT_STARTING_ROAD_CELLS = [{ x: 2, y: 1 }, { x: 3, y: 1 }]

/**
 * @param {Object} grid
 * @param {{x: number, y: number}[]} [cells]
 */
export function seedStartingRoads (grid, cells = DEFAULT_STARTING_ROAD_CELLS) {
  cells.forEach(({ x, y }) => addRoadsAroundCell(grid, x, y))
}
