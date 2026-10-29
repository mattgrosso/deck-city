// The spatial grid buildings get placed on. Plain data + functions, same
// style as the rest of the engine — cells hold an instanceId (or null),
// never the card/instance itself, so the grid stays a thin index rather
// than a second source of truth for building data. Roads live on the grid
// too, but on the *edges* between cells rather than in a cell — a cell's
// "road frontage" is having a road on any of its 4 bordering edges, which
// is what makes it buildable (see isBuildable / hasRoadFrontage below).

// 12×8 (was 6×4; Matt filled it in nine turns: "I should be able to expand much further").
export const DEFAULT_CITY_GRID_SIZE = { width: 12, height: 8 }

/**
 * @param {Object} [options]
 * @param {number} [options.width]
 * @param {number} [options.height]
 */
export function createCityGrid ({ width, height } = DEFAULT_CITY_GRID_SIZE) {
  // `limits` is the part of the grid the city may use right now - the run
  // widens it each era (turn/run.js). Defaults to the whole grid.
  return { width, height, cells: Array(width * height).fill(null), roads: new Set(), limits: { x0: 0, y0: 0, x1: width, y1: height } }
}

/** Is a cell inside the current city limits? */
export function isInLimits (grid, x, y) {
  const l = grid.limits ?? { x0: 0, y0: 0, x1: grid.width, y1: grid.height }
  return x >= l.x0 && x < l.x1 && y >= l.y0 && y < l.y1
}

/** Is an edge inside the current city limits (on or within the boundary)? */
export function isEdgeInLimits (grid, key) {
  const l = grid.limits ?? { x0: 0, y0: 0, x1: grid.width, y1: grid.height }
  const { kind, x, y } = parseEdgeKey(key)
  return kind === 'h'
    ? x >= l.x0 && x < l.x1 && y >= l.y0 && y <= l.y1
    : x >= l.x0 && x <= l.x1 && y >= l.y0 && y < l.y1
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
  return isInBounds(grid, x, y) && isInLimits(grid, x, y) && hasRoadFrontage(grid, x, y)
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

/**
 * A single edge key from its parts. 'h' edges run along x on the boundary
 * above row y (y in 0..height); 'v' edges run along y on the boundary left
 * of column x (x in 0..width).
 */
export function edgeKey (kind, x, y) {
  return `${kind}:${x},${y}`
}

/** @returns {{kind: 'h'|'v', x: number, y: number}} the parts of an edge key */
export function parseEdgeKey (key) {
  const [kind, coords] = key.split(':')
  const [x, y] = coords.split(',').map(Number)
  return { kind, x, y }
}

/** Is this edge on the grid at all? */
export function isEdgeInBounds (grid, key) {
  const { kind, x, y } = parseEdgeKey(key)
  if (kind === 'h') return x >= 0 && x < grid.width && y >= 0 && y <= grid.height
  if (kind === 'v') return x >= 0 && x <= grid.width && y >= 0 && y < grid.height
  return false
}

/**
 * Paints ONE edge as roaded - a Road card is a segment between two
 * spaces, not a ring round one (Matt, 2026-10-29: "I don't like that the
 * roads wrap an entire square... I would rather have them be individual
 * segments"). Throws for an edge off the grid or one already roaded.
 */
export function addRoadEdge (grid, key) {
  if (!isEdgeInBounds(grid, key)) throw new Error(`Edge ${key} is off the grid`)
  if (grid.roads.has(key)) throw new Error(`Edge ${key} already has a road`)
  grid.roads.add(key)
}

/** Every edge on the grid, roaded or not, for a UI that aims at them. */
export function listAllEdges (grid) {
  const out = []
  for (let y = 0; y <= grid.height; y++) for (let x = 0; x < grid.width; x++) out.push({ key: edgeKey('h', x, y), kind: 'h', x, y, roaded: grid.roads.has(edgeKey('h', x, y)) })
  for (let y = 0; y < grid.height; y++) for (let x = 0; x <= grid.width; x++) out.push({ key: edgeKey('v', x, y), kind: 'v', x, y, roaded: grid.roads.has(edgeKey('v', x, y)) })
  return out
}

/** A short street through the middle, so a new game has somewhere legal to build. */
export const DEFAULT_STARTING_ROAD_EDGES = ['h:5,4', 'h:6,4']
/** The cells that street gives frontage to (either side of it). */
export const DEFAULT_STARTING_ROAD_CELLS = [{ x: 5, y: 3 }, { x: 6, y: 3 }, { x: 5, y: 4 }, { x: 6, y: 4 }]

/** The two corner nodes an edge runs between. */
export function edgeNodes (key) {
  const { kind, x, y } = parseEdgeKey(key)
  return kind === 'h' ? [[x, y], [x + 1, y]] : [[x, y], [x, y + 1]]
}

/**
 * Does this edge touch the existing street network? A new street has to
 * start from one that is already there (Matt: "it's dumb that I can build
 * a road not attached to any other roads"). `extra` are edges being laid
 * in the same play, which count as already there.
 */
export function isEdgeConnected (grid, key, extra = []) {
  const have = new Set([...grid.roads, ...extra])
  if (have.size === 0) return true // the very first street of a city may go anywhere
  const touches = new Set(edgeNodes(key).map(([x, y]) => `${x},${y}`))
  for (const other of have) {
    if (other === key) continue
    if (edgeNodes(other).some(([x, y]) => touches.has(`${x},${y}`))) return true
  }
  return false
}

/** Every unroaded edge a new street may go on right now. */
export function listConnectedEdges (grid, extra = []) {
  const laid = new Set(extra)
  return listAllEdges(grid).filter(e => !e.roaded && !laid.has(e.key) && isEdgeInLimits(grid, e.key) && isEdgeConnected(grid, e.key, extra))
}

/**
 * @param {Object} grid
 * @param {string[]} [edges] - edge keys
 */
export function seedStartingRoads (grid, edges = DEFAULT_STARTING_ROAD_EDGES) {
  edges.forEach(key => grid.roads.add(key))
}
