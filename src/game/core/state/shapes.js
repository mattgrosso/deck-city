// MULTI-TILE BUILDINGS (Matt, 2026-10-29: "a school takes two tiles or a
// high school takes two tiles... I like the idea of sort of having to
// Tetris them in on the grid"). A card's `shape` names the cells it covers,
// as offsets from the cell it is aimed at (the anchor); it may be turned
// a quarter at a time. One instance fills every cell it covers; its
// neighbours are everything touching any of them.
//
// A building needs a street beside ANY of its cells, and no street may run
// between two of its own cells (nor be laid there later).

import { isInBounds, isCellEmpty, isInLimits, cellEdgeKeys } from './cityGrid'

export const SHAPES = {
  one: [[0, 0]],
  I2: [[0, 0], [1, 0]],
  I3: [[0, 0], [1, 0], [2, 0]],
  L3: [[0, 0], [1, 0], [0, 1]],
  O4: [[0, 0], [1, 0], [0, 1], [1, 1]]
}

/** A card's cell offsets, unturned. `shape` is a SHAPES name or a list of [dx, dy]. */
export function shapeOf (card) {
  if (!card?.shape) return SHAPES.one
  return typeof card.shape === 'string' ? (SHAPES[card.shape] ?? SHAPES.one) : card.shape
}

export const isMultiTile = (card) => shapeOf(card).length > 1

/** Offsets turned `rotation` quarter turns clockwise about the anchor. */
export function turnOffsets (offsets, rotation = 0) {
  let out = offsets
  for (let r = 0; r < ((rotation % 4) + 4) % 4; r++) out = out.map(([x, y]) => [-y, x])
  return out
}

/** The cells a card would cover with its anchor at `position`, turned `rotation`. */
export function footprint (card, position, rotation = 0) {
  return turnOffsets(shapeOf(card), rotation).map(([dx, dy]) => ({ x: position.x + dx, y: position.y + dy }))
}

/** Edge keys shared by two cells of the same footprint: inside the building. */
export function innerEdges (cells) {
  const seen = new Map()
  for (const c of cells) for (const key of Object.values(cellEdgeKeys(c.x, c.y))) seen.set(key, (seen.get(key) ?? 0) + 1)
  return [...seen].filter(([, n]) => n > 1).map(([k]) => k)
}

/**
 * Why `card` can't stand there, or null if it can. Checks every cell:
 * on the map, inside the city limits, empty land; a street beside one of
 * them (unless the card skips that); no street between two of them.
 */
export function placementProblem (state, card, position, rotation = 0) {
  const grid = state.cityGrid
  const cells = footprint(card, position, rotation)
  for (const c of cells) {
    if (!isInBounds(grid, c.x, c.y)) return 'That runs off the map'
    if (!isInLimits(grid, c.x, c.y)) return 'That plot is outside the city limits'
    if (!isCellEmpty(grid, c.x, c.y)) return cells.length > 1 ? 'It doesn\'t fit there: something is in the way' : `Invalid or occupied cell: ${JSON.stringify(position)}`
  }
  const inner = new Set(innerEdges(cells))
  for (const key of inner) if (grid.roads.has(key)) return 'A street runs through that spot'
  if (!card.skipsRoadRequirement) {
    const frontage = cells.some(c => Object.values(cellEdgeKeys(c.x, c.y)).some(k => !inner.has(k) && grid.roads.has(k)))
    if (!frontage) return `Cell (${position.x}, ${position.y}) has no road access`
  }
  return null
}

