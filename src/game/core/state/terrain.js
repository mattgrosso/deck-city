// The land the city is built on (Matt, 2026-10-29: "some sense of
// terrain... maybe a water feature would be cool. It'd be cool if it was a
// randomized map each game"). Water is the only terrain so far: a cell of
// water can never be built on, a street may still bridge it, and a home or
// shop beside it is worth a little more (WATERFRONT below).
//
// grid.terrain is one entry per cell, null for grass or 'water'. The map is
// drawn once at the start of a game from the game's rng, keeping the
// starting city and the land round it dry.

/** What a building beside water gains, once however much water it touches. */
export const WATERFRONT = [
  { tag: 'residential', stat: 'population', amount: 1 },
  { tag: 'commercial', stat: 'revenue', amount: 1 }
]

export function isWater (grid, x, y) {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height && grid.terrain?.[y * grid.width + x] === 'water'
}

/** Does this cell touch water on any of its four sides? */
export function touchesWater (grid, x, y) {
  return [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => isWater(grid, x + dx, y + dy))
}

const inBox = (box, x, y) => box && x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1

// A river runs edge to edge, wandering a cell at a time and stepping round
// the dry ground; a lake is a lumpy blob; a coast is sea along one side.
function river (grid, rng, set, dry, narrow) {
  const across = rng() < 0.5 // true: runs top to bottom
  const len = across ? grid.height : grid.width
  const span = across ? grid.width : grid.height
  // Start in an outer third so it bends past the town, not through it.
  let at = rng() < 0.5 ? Math.floor(rng() * span * 0.3) : span - 1 - Math.floor(rng() * span * 0.3)
  const wide = rng() < 0.4
  for (let i = 0; i < len; i++) {
    const r = rng()
    const step = r < 0.25 ? -1 : r < 0.5 ? 1 : 0
    const next = Math.max(0, Math.min(span - 1, at + step))
    const hits = (p) => (across ? dry(p, i) : dry(i, p))
    if (!hits(next)) at = next
    // A bend sets down a second cell so the river stays joined up.
    const cells = [at]
    if (step && next === at) cells.push(at - step)
    if (wide && !(across ? narrow(at + 1, i) : narrow(i, at + 1))) cells.push(at + 1)
    for (const p of cells) if (p >= 0 && p < span) across ? set(p, i) : set(i, p)
  }
}

function lake (grid, rng, set, cx, cy, size) {
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const d = Math.hypot((x - cx) / size, (y - cy) / (size * 0.8))
      if (d < 1 + (rng() - 0.5) * 0.5) set(x, y)
    }
  }
}

function coast (grid, rng, set) {
  const side = Math.floor(rng() * 4) // 0 top, 1 right, 2 bottom, 3 left
  const along = side % 2 === 0 ? grid.width : grid.height
  let depth = 2 + Math.floor(rng() * 2)
  for (let i = 0; i < along; i++) {
    depth = Math.max(1, Math.min(4, depth + (rng() < 0.3 ? -1 : rng() < 0.45 ? 1 : 0)))
    for (let d = 0; d < depth; d++) {
      if (side === 0) set(i, d)
      if (side === 2) set(i, grid.height - 1 - d)
      if (side === 3) set(d, i)
      if (side === 1) set(grid.width - 1 - d, i)
    }
  }
}

/**
 * Lay water on the grid. `dry` is a box no water may enter (the starting
 * town and a ring round it); `firstEra` is the first era's limits, where
 * only a pond's worth of water is allowed so the opening has room to grow.
 * @returns {string} which feature was drawn ('river' | 'lake' | 'coast' | 'river+lake')
 */
export function generateTerrain (grid, rng, { dry = null, firstEra = null, maxFirstEra = 10 } = {}) {
  grid.terrain = Array(grid.width * grid.height).fill(null)
  const isDry = (x, y) => inBox(dry, x, y)
  const set = (x, y) => {
    if (x < 0 || y < 0 || x >= grid.width || y >= grid.height || isDry(x, y)) return
    grid.terrain[y * grid.width + x] = 'water'
  }
  const roll = rng()
  const kind = roll < 0.35 ? 'river' : roll < 0.6 ? 'lake' : roll < 0.85 ? 'coast' : 'river+lake'
  if (kind.includes('river')) river(grid, rng, set, isDry, (x, y) => inBox(firstEra, x, y))
  if (kind.includes('lake')) {
    // Off to one side of the town, partly in the first era's ground.
    const left = rng() < 0.5
    const cx = left ? 2 + Math.floor(rng() * 5) : grid.width - 3 - Math.floor(rng() * 5)
    const cy = 2 + Math.floor(rng() * (grid.height - 4))
    lake(grid, rng, set, cx, cy, kind === 'lake' ? 2.4 + rng() * 1.2 : 1.8)
  }
  if (kind === 'coast') coast(grid, rng, set)
  // Keep the first era roomy: drain water there past a pond's worth,
  // starting with the cells nearest the town.
  if (firstEra) {
    const wet = []
    for (let y = firstEra.y0; y < firstEra.y1; y++) for (let x = firstEra.x0; x < firstEra.x1; x++) if (isWater(grid, x, y)) wet.push({ x, y })
    const mid = { x: (firstEra.x0 + firstEra.x1) / 2, y: (firstEra.y0 + firstEra.y1) / 2 }
    wet.sort((a, b) => Math.hypot(a.x - mid.x, a.y - mid.y) - Math.hypot(b.x - mid.x, b.y - mid.y))
    for (const c of wet.slice(0, Math.max(0, wet.length - maxFirstEra))) grid.terrain[c.y * grid.width + c.x] = null
  }
  return kind
}
