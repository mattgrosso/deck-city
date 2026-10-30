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

import { cellEdgeKeys, parseEdgeKey } from '@/game/core'
import { familyOf } from '@/ui/cardText'
import { lookFor, lookModels } from './looks'

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
      lots.push({ id: `lot:${x},${y}`, x, y, wx, wz, ground: water ? 'water' : recipe?.ground ?? (instance ? 'built' : 'empty'), instanceId: id ?? null })
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

  return { lots, placements, roadEdges, roadNodes }
}

/** Every model any recipe or road can ask for, so the world can preload. */
export function allModels () {
  const out = new Set(['suburban/tree-large', 'suburban/tree-small', ...TOWERS, 'commercial/building-skyscraper-e', 'roads/light-curved', 'roads/light-square', 'suburban/planter'])
  Object.values(RECIPES).forEach(r => r.variants.forEach(v => v.parts.forEach(p => out.add(p.model))))
  lookModels().forEach(m => out.add(m))
  return [...out]
}
