// PURE: the engine's city (grid + built structures + roads-as-edges) turned
// into a list of placements for the three.js world (cityWorld.js) - which
// Kenney model stands where, how big, facing which way. Unit-tested; the
// renderer only diffs this list by id. Change what the city looks like HERE.
//
// Geometry: a cell is a LOT of LOT units, and roads run in the gaps between
// lots along the engine's edges. The corner points of the lots are the road
// network's nodes; an edge with a road gets a straight tile, a node with
// roads meeting gets the matching junction tile. Kenney's road tiles are
// 1×1 with pavements, so an edge tile is scaled to the gap's width.

import { cellEdgeKeys, parseEdgeKey, innerEdges } from '@/game/core'
import { familyOf } from '@/ui/cardText'
import { lookFor, lookModels, multiLookFor } from './looks'
import { WIDE } from './buildgen'

export const LOT = 1.0
export const GAP = 0.48 // the road's width, in world units
export const PITCH = LOT + GAP

/** World x/z of a cell's centre. The grid is centred on the origin. */
export function cellCentre (grid, x, y) {
  return {
    x: (x - (grid.width - 1) / 2) * PITCH,
    z: (y - (grid.height - 1) / 2) * PITCH
  }
}

/** World x/z of an edge's middle and the axis it runs along. */
export function edgeCentre (grid, key) {
  const { kind, x, y } = parseEdgeKey(key)
  const c = cornerPoint(grid, x, y)
  return kind === 'h'
    ? { x: c.x + PITCH / 2, z: c.z, axis: 'x' }
    : { x: c.x, z: c.z + PITCH / 2, axis: 'z' }
}

/** World x/z of the lot corner (cx, cy): corner (0,0) is the top-left of cell (0,0). */
export function cornerPoint (grid, cx, cy) {
  const c = cellCentre(grid, cx, cy)
  return { x: c.x - PITCH / 2, z: c.z - PITCH / 2 }
}

// One recipe per card id: the parts that make the building, each with its
// own offset (in lot units, -0.5..0.5), yaw and scale. `variants` lists
// interchangeable looks, picked by the instance's sequence number so two
// houses on one street differ. Scales are measured against the kits
// (dev-models.html): a suburban house is ~1.3 wide, a lot is 1.0.
const HOUSE = (model) => ({ parts: [{ model: `suburban/${model}`, scale: 0.76 }] })
const SHOP = (model, scale = 0.92) => ({ parts: [{ model: `commercial/${model}`, scale }] })
const PLANT = (model, scale = 0.5) => ({ parts: [{ model: `industrial/${model}`, scale }] })

export const RECIPES = {
  // Roads never become instances (they paint edges), but a Road card in hand
  // still needs a ghost to aim with.
  road: { variants: [{ parts: [] }] }, // drawn as a ghost street by the world
  residential: {
    variants: [HOUSE('building-type-a'), HOUSE('building-type-c'), HOUSE('building-type-e'), HOUSE('building-type-o'), HOUSE('building-type-r'), HOUSE('building-type-s'), HOUSE('building-type-j'), HOUSE('building-type-l')]
  },
  commercial: {
    variants: [SHOP('building-a'), SHOP('building-b'), SHOP('building-d'), SHOP('building-h'), SHOP('building-f', 0.86), SHOP('building-g', 0.86)]
  },
  industrial: {
    variants: [PLANT('building-d', 0.7), PLANT('building-g', 0.6), PLANT('building-m', 0.64), PLANT('building-e', 0.6), PLANT('building-t', 0.6)]
  },
  'police-station': {
    variants: [{ parts: [{ model: 'commercial/building-c', scale: 0.82, tint: 0x6f8fe8 }, { model: 'roads/light-square', scale: 0.7, dx: 0.42, dz: 0.4 }] }]
  },
  'fire-station': {
    variants: [{ parts: [{ model: 'commercial/building-e', scale: 0.56, tint: 0xf26b5b }, { model: 'roads/light-square', scale: 0.7, dx: -0.42, dz: 0.4 }] }]
  },
  clinic: {
    variants: [{ parts: [{ model: 'commercial/building-k', scale: 0.46, tint: 0xf4f6fb }, { model: 'suburban/planter', scale: 0.7, dx: 0.3, dz: 0.42 }] }]
  },
  'sanitation-center': {
    variants: [{ parts: [{ model: 'industrial/building-k', scale: 0.62, tint: 0x9fd8c0 }, { model: 'roads/dumpster', scale: 0.9, dx: -0.36, dz: 0.38, yaw: 0.4 }, { model: 'roads/dumpster', scale: 0.9, dx: -0.2, dz: 0.4, yaw: 0.4 }] }]
  },
  park: {
    variants: [{
      parts: [
        { model: 'suburban/tree-large', scale: 1.0, dx: -0.3, dz: -0.28 },
        { model: 'suburban/tree-large', scale: 0.9, dx: 0.28, dz: 0.1 },
        { model: 'suburban/tree-small', scale: 1.0, dx: 0.1, dz: -0.32 },
        { model: 'suburban/tree-small', scale: 0.9, dx: -0.28, dz: 0.3 },
        { model: 'suburban/planter', scale: 0.9, dx: 0.3, dz: 0.36 },
        { model: 'suburban/path-long', scale: 1.4, dx: 0, dz: 0.08 }
      ],
      ground: 'park'
    }]
  },
  monument: {
    variants: [{ parts: [{ model: 'commercial/building-skyscraper-a', scale: 0.46, tint: 0xffe6b0 }], ground: 'plaza' }]
  }
}

// COMBINED BUILDINGS grow on the board (Matt, 2026-10-29: "I'd like for
// the buildings to get bigger as they combine... look cooler and cooler").
// One plot always, but more on it at every size:
//   pair (2)       the dearer half, with the other half beside it as an annex
//   Quarter (4)    the main building larger, two annexes, a paved plaza
//   District (8)   a tower over the plaza, low buildings and street lamps
//   Borough (16)   a tall gold-crowned skyscraper, lamps and trees round it
const TOWERS = ['commercial/building-skyscraper-a', 'commercial/building-skyscraper-b', 'commercial/building-skyscraper-c']
const mainPart = (card, seq) => recipeFor(card, seq).parts[0] ?? { model: 'commercial/building-a', scale: 0.8 }
const at = (part, dx, dz, k, extra = {}) => ({ ...part, dx, dz, scale: (part.scale ?? 1) * k, ...extra })
function comboRecipe (card, seq) {
  const size = card.size ?? 2
  const main = mainPart(card.lookAs, seq)
  const annex = mainPart(card.annexAs ?? card.lookAs, seq + 1)
  const h = [...card.id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7)
  if (size >= 16) {
    return {
      key: card.id,
      ground: 'plaza',
      parts: [
        { model: 'commercial/building-skyscraper-e', scale: 0.62, dx: -0.04, dz: -0.06, tint: 0xffe6b0 },
        at(annex, 0.32, 0.3, 0.42),
        { model: 'roads/light-curved', scale: 0.6, dx: -0.42, dz: 0.42 },
        { model: 'roads/light-curved', scale: 0.6, dx: 0.42, dz: -0.42, yaw: Math.PI },
        { model: 'suburban/tree-small', scale: 0.7, dx: -0.4, dz: -0.38 },
        { model: 'suburban/tree-small', scale: 0.7, dx: 0.4, dz: 0.02 }
      ]
    }
  }
  if (size >= 8) {
    return {
      key: card.id,
      ground: 'plaza',
      parts: [
        { model: TOWERS[h % TOWERS.length], scale: 0.5, dx: -0.12, dz: -0.12 },
        at(main, 0.3, 0.28, 0.5),
        at(annex, -0.32, 0.32, 0.45),
        { model: 'roads/light-square', scale: 0.6, dx: 0.42, dz: -0.4 }
      ]
    }
  }
  if (size >= 4) {
    return {
      key: card.id,
      ground: 'plaza',
      parts: [
        at(main, -0.1, -0.12, 0.95),
        at(annex, 0.32, 0.3, 0.5),
        at(annex, -0.34, 0.34, 0.45, { yaw: Math.PI / 2 }),
        { model: 'suburban/planter', scale: 0.8, dx: 0.38, dz: -0.36 }
      ]
    }
  }
  return { key: card.id, ground: recipeFor(card.lookAs, seq).ground, parts: [at(main, -0.1, -0.1, 0.85), at(annex, 0.3, 0.3, 0.5)] }
}

// ---------------------------------------------------- multi-tile plans

/** A multi-tile footprint split into its long ARM (a straight run) and the LEG left over. */
export function splitFootprint (cells) {
  const line = (list) => list.every(c => c.y === list[0].y) || list.every(c => c.x === list[0].x)
  if (line(cells)) return { arm: cells, leg: [] }
  const touching = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1
  if (cells.length === 3) {
    const corner = cells.find(c => cells.filter(o => o !== c && touching(c, o)).length === 2)
    const rest = cells.filter(c => c !== corner)
    return { arm: [corner, rest[0]], leg: [rest[1]] }
  }
  const top = Math.min(...cells.map(c => c.y))
  return { arm: cells.filter(c => c.y === top), leg: cells.filter(c => c.y !== top) }
}

const centreOf = (grid, cells) => {
  const pts = cells.map(c => cellCentre(grid, c.x, c.y))
  return { x: pts.reduce((n, p) => n + p.x, 0) / pts.length, z: pts.reduce((n, p) => n + p.z, 0) / pts.length }
}

/** How many extra bays make a WIDE source about `length` long when `depth` deep. */
const baysFor = (src, length, depth) => { const w = WIDE[src]; return Math.max(0, Math.round(((length / depth) * w.depth - w.width) / 0.4)) }

/** A wide building (buildgen WIDE) laid along a run of plots, as long as the run. */
function wideAlong (grid, spec, run, depth = LOT * 0.82) {
  const c = centreOf(grid, run)
  const alongX = run.every(r => r.y === run[0].y)
  const length = run.length * PITCH - GAP - 0.12
  const bays = baysFor(spec.src, length, depth)
  return { gen: { ...spec, id: `${spec.id}:${bays}`, bays }, model: spec.src, x: c.x, z: c.z, yaw: alongX ? 0 : Math.PI / 2, fit: length, depth, scale: 1 }
}

function multiPlacements (grid, plan, cells, put) {
  const parts = []
  const { arm, leg } = splitFootprint(cells)
  const add = (p, i) => put({ ...p, dx: 0, dz: 0 }, p.x, p.z, i)
  if (plan.kind === 'stadium') {
    // Stands round a pitch, floodlights at the corners.
    const c = centreOf(grid, cells)
    const h = PITCH - 0.32
    const src = 'industrial/building-s'
    const side = { length: PITCH * 2 - 0.4, depth: 0.42 }; const end = { length: PITCH * 1.25, depth: 0.36 }
    const stand = (len, dep, id) => ({ id, type: 'wide', src, bays: baysFor(src, len, dep), palette: 'sand', props: [] })
    const long = stand(side.length, side.depth, 'stand-side'); const short = stand(end.length, end.depth, 'stand-end')
    parts.push({ gen: long, model: src, x: c.x, z: c.z - h, yaw: 0, fit: side.length, depth: side.depth })
    parts.push({ gen: long, model: src, x: c.x, z: c.z + h, yaw: Math.PI, fit: side.length, depth: side.depth })
    parts.push({ gen: short, model: src, x: c.x - h, z: c.z, yaw: Math.PI / 2, fit: end.length, depth: end.depth })
    parts.push({ gen: short, model: src, x: c.x + h, z: c.z, yaw: -Math.PI / 2, fit: end.length, depth: end.depth })
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push({ model: 'roads/light-square', x: c.x + sx * (PITCH - 0.05), z: c.z + sz * (PITCH - 0.05), scale: 2.2, yaw: 0 })
    parts.forEach(add)
    return []
  }
  const depth = plan.depth ?? LOT * 0.82
  const along = wideAlong(grid, plan.arm, arm, depth)
  // A shallower building stands at the back of its plots, leaving a front.
  const alongX = arm.every(r => r.y === arm[0].y)
  const back = (LOT * 0.82 - depth) / 2
  if (alongX) along.z -= back; else along.x -= back
  parts.push(along)
  if (plan.spire) {
    const end = cellCentre(grid, arm.at(-1).x, arm.at(-1).y)
    parts.push({ gen: plan.spire, model: plan.spire.src, x: alongX ? end.x + 0.15 : along.x, z: alongX ? along.z : end.z + 0.15, yaw: 0, fit: plan.spireFit ?? 0.5, scale: 1 })
  }
  // Things along the front: parasols, a playground, signals (the side the camera sees).
  if (plan.front?.length) {
    const c0 = centreOf(grid, arm)
    const len = arm.length * PITCH - GAP - 0.4
    const n = Math.max(2, arm.length * 2)
    for (let i = 0; i < n; i++) {
      const t = -len / 2 + (i + 0.5) * len / n
      const model = plan.front[i % plan.front.length]
      const off = depth / 2 + 0.12 - back
      parts.push({ model, x: alongX ? c0.x + t : c0.x + off, z: alongX ? c0.z + off : c0.z + t, yaw: alongX ? 0 : Math.PI / 2, scale: model.includes('fence') ? 0.5 : model.startsWith('roads/') ? 0.8 : 0.9 })
    }
  }
  if (plan.kind === 'themepark') {
    // Rides on the far side of the gate: a wheel of parasols, a tower ride, trees.
    for (const [i, cell] of leg.entries()) {
      const p = cellCentre(grid, cell.x, cell.y)
      parts.push({ model: i % 2 ? 'industrial/water-tower' : 'commercial/detail-parasol-a', x: p.x, z: p.z, scale: i % 2 ? 0.7 : 1.6, yaw: 0 })
      parts.push({ model: 'commercial/detail-parasol-b', x: p.x + 0.3, z: p.z + 0.3, scale: 1.1, yaw: 0 })
      parts.push({ model: 'suburban/tree-small', x: p.x - 0.32, z: p.z - 0.3, scale: 1, yaw: 0 })
    }
  } else if (plan.leg || plan.legs) {
    for (const [i, cell] of leg.entries()) {
      const p = cellCentre(grid, cell.x, cell.y)
      const spec = plan.legs ? plan.legs[i % plan.legs.length] : plan.leg
      parts.push({ gen: spec, model: spec.src, x: p.x, z: p.z, yaw: 0, fit: spec.type === 'tower' ? 0.6 : 0.86, scale: 1 })
      if (i === 0) for (const pr of plan.legProps ?? []) parts.push({ ...pr, x: p.x + pr.dx * LOT, z: p.z + pr.dz * LOT })
    }
  } else if (leg.length) {
    // A 2×2 with no leg building: a second wide one, back to back.
    parts.push(wideAlong(grid, plan.arm, leg))
  }
  parts.forEach(add)
  return []
}

/** The recipe for a built instance: by card id, else goals are monuments, else by family. */
export function recipeFor (card, seq = 0) {
  if (card.combo) return comboRecipe(card, seq)
  if (RECIPES[card.id] || card.type === 'goal' || !card.tier) {
    const key = RECIPES[card.id] ? card.id : card.type === 'goal' ? 'monument' : familyOf(card)
    const recipe = RECIPES[key] ?? RECIPES.commercial
    const variant = recipe.variants[seq % recipe.variants.length]
    return { key, ...variant }
  }
  // The city catalogue (cityCards.js): looks.js draws each card its own way.
  return { key: card.id, ...lookFor(card) }
}

/** A small, fixed scatter of trees for an empty cell (0-2 of them). */
export function treesFor (x, y) {
  const h = ((x * 73856093) ^ (y * 19349663)) >>> 0
  const count = h % 3
  const out = []
  for (let n = 0; n < count; n++) {
    const k = (h >> (n * 5)) & 31
    out.push({ n, model: k % 3 === 0 ? 'suburban/tree-large' : 'suburban/tree-small', dx: ((k % 7) - 3) * 0.11, dz: (((k >> 2) % 7) - 3) * 0.11, yaw: (k % 6) * 1.05, scale: 0.9 + (k % 4) * 0.08 })
  }
  return out
}

const seqOf = (instance) => Number((instance.instanceId.split('#')[1] ?? 0)) || 0

/**
 * Where a building's parts stand, for any number of cells (a multi-tile
 * building, state/shapes.js). One cell: its recipe on the lot. A row or an
 * L: a building on every cell, each a variant, so a School reads as a small
 * campus. A 2×2: one centrepiece, twice the size, in the middle. Returns
 * placements with ids under `prefix`.
 */
export function buildingPlacements (grid, card, seq, cells, prefix) {
  const recipe = recipeFor(card, seq)
  const at = cells.map(c => cellCentre(grid, c.x, c.y))
  const out = []
  const put = (part, x, z, i, k = 1) => out.push({ id: `${prefix}:${i}`, model: part.model, gen: part.gen ?? null, fit: part.fit ?? null, depth: part.depth ?? null, x: x + (part.dx ?? 0) * LOT * k, z: z + (part.dz ?? 0) * LOT * k, yaw: part.yaw ?? 0, scale: (part.scale ?? 1) * k, tint: part.tint ?? null, kind: recipe.key })
  const plan = cells.length > 1 ? multiLookFor(card) : { kind: 'percell' }
  if (plan.kind !== 'percell') { multiPlacements(grid, plan, cells, put); return { placements: out, ground: plan.ground ?? recipe.ground } }
  at.forEach((p, c) => {
    const parts = c === 0 ? recipe.parts : recipeFor(card, seq + c).parts
    parts.forEach((part, i) => put(part, p.x, p.z, `${c}.${i}`))
  })
  return { placements: out, ground: recipe.ground }
}

/**
 * @param {Object} grid - the engine's cityGrid (width, height, cells, roads: Set of edge keys)
 * @param {Object[]} structures - the engine's builtStructures
 * @returns {{ lots: Object[], placements: Object[], roadEdges: Object[], roadNodes: Object[] }}
 */
export function layoutCity (grid, structures) {
  const byId = new Map(structures.map(s => [s.instanceId, s]))
  const lots = []
  const placements = []

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const id = grid.cells[y * grid.width + x]
      const instance = id ? byId.get(id) : null
      const { x: wx, z: wz } = cellCentre(grid, x, y)
      const recipe = instance ? recipeFor(instance.card, seqOf(instance)) : null
      const water = !instance && grid.terrain?.[y * grid.width + x] === 'water'
      const multiGround = instance?.cells?.length > 1 ? multiLookFor(instance.card).ground : null
      lots.push({ id: `lot:${x},${y}`, x, y, wx, wz, ground: water ? 'water' : multiGround ?? recipe?.ground ?? (instance ? 'built' : 'empty'), instanceId: id ?? null })
      // A building on more than one cell is laid out once, from its anchor.
      if (instance?.cells?.length > 1) {
        if (instance.position.x === x && instance.position.y === y) placements.push(...buildingPlacements(grid, instance.card, seqOf(instance), instance.cells, instance.instanceId).placements)
        continue
      }
      if (water) continue
      if (!instance) {
        // Empty land is not empty: a tree or two, placed by the cell's own
        // number so the same lot always looks the same, cleared when built on.
        for (const t of treesFor(x, y)) {
          placements.push({ id: `tree:${x},${y}:${t.n}`, model: t.model, x: wx + t.dx * LOT, z: wz + t.dz * LOT, yaw: t.yaw, scale: t.scale, kind: 'tree' })
        }
        continue
      }
      recipe.parts.forEach((part, i) => {
        placements.push({
          id: `${instance.instanceId}:${i}`,
          model: part.model,
          gen: part.gen ?? null,
          x: wx + (part.dx ?? 0) * LOT,
          z: wz + (part.dz ?? 0) * LOT,
          yaw: part.yaw ?? 0,
          scale: part.scale ?? 1,
          tint: part.tint ?? null,
          kind: recipe.key
        })
      })
    }
  }

  // Roads: every edge with a road, and every corner node where roads meet,
  // as plain geometry for the world to draw (the kit's 1×1 road tiles
  // could not be scaled into a 0.48-wide street without their pavements
  // and markings turning into mush - Matt: "they look like shit").
  const roadEdges = []
  const roadNodes = []
  const seenEdges = new Set()
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const edges = cellEdgeKeys(x, y)
      const centre = cellCentre(grid, x, y)
      const half = PITCH / 2
      const add = (key, px, pz, axis) => {
        if (!grid.roads.has(key) || seenEdges.has(key)) return
        seenEdges.add(key)
        roadEdges.push({ id: `road:${key}`, x: px, z: pz, axis })
      }
      add(edges.top, centre.x, centre.z - half, 'x')
      add(edges.bottom, centre.x, centre.z + half, 'x')
      add(edges.left, centre.x - half, centre.z, 'z')
      add(edges.right, centre.x + half, centre.z, 'z')
    }
  }
  for (let cy = 0; cy <= grid.height; cy++) {
    for (let cx = 0; cx <= grid.width; cx++) {
      const arms = []
      if (cy > 0 && grid.roads.has(`v:${cx},${cy - 1}`)) arms.push('n')
      if (cx < grid.width && grid.roads.has(`h:${cx},${cy}`)) arms.push('e')
      if (cy < grid.height && grid.roads.has(`v:${cx},${cy}`)) arms.push('s')
      if (cx > 0 && grid.roads.has(`h:${cx - 1},${cy}`)) arms.push('w')
      if (!arms.length) continue
      const p = cornerPoint(grid, cx, cy)
      roadNodes.push({ id: `node:${cx},${cy}`, x: p.x, z: p.z, arms })
    }
  }

  // The gaps between a multi-tile building's own cells are paved over (or
  // grassed, for a park), so it reads as one site.
  const bridges = []
  for (const s of structures) {
    if (!(s.cells?.length > 1)) continue
    const ground = multiLookFor(s.card).ground ?? recipeFor(s.card, seqOf(s)).ground ?? 'built'
    for (const key of innerEdges(s.cells)) {
      const { kind, x, y } = parseEdgeKey(key)
      const c = cornerPoint(grid, x, y)
      bridges.push({ id: `bridge:${key}`, x: kind === 'h' ? c.x + PITCH / 2 : c.x, z: kind === 'h' ? c.z : c.z + PITCH / 2, axis: kind === 'h' ? 'x' : 'z', ground })
    }
    // ...and the square where four cells meet, for a 2×2.
    if (s.cells.length === 4) {
      const mx = Math.max(...s.cells.map(c => c.x)); const my = Math.max(...s.cells.map(c => c.y))
      const c = cornerPoint(grid, mx, my)
      bridges.push({ id: `bridge:mid:${s.instanceId}`, x: c.x, z: c.z, axis: 'node', ground })
    }
  }

  return { lots, placements, roadEdges, roadNodes, bridges }
}

/** Every model any recipe or road can ask for, so the world can preload. */
export function allModels () {
  const out = new Set(['suburban/tree-large', 'suburban/tree-small', ...TOWERS, 'commercial/building-skyscraper-e', 'roads/light-curved', 'roads/light-square', 'suburban/planter'])
  Object.values(RECIPES).forEach(r => r.variants.forEach(v => v.parts.forEach(p => out.add(p.model))))
  lookModels().forEach(m => out.add(m))
  return [...out]
}
