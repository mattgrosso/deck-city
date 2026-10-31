// THE CITY PLACES ITS OWN BUILDINGS (Matt, 2026-10-31: "what if where the
// stuff goes in the city is no longer part of the choice the user plays? You
// just play the card, the game picks the best spot for it and places it
// there... more like a little ant farm that's running on its own").
//
// choosePlacement scores every spot the building could stand and returns the
// best: what the whole city gains there (its own stats and every neighbour's,
// previewPlacement), weighted by what the city is short of right now (jobs
// while people are out of work, homes while jobs stand empty), plus a pull
// toward its own kind so districts form (homes by homes, shops by shops) and
// toward the middle so the town grows outward instead of scattering.
//
// The city lays its own streets too: a spot with no street beside it is
// still a candidate if a short new street (MAX_STREETS segments), joined to
// the network, would reach it. That street goes down with the building (no
// Road cards any more), and each segment counts against the spot.

import { footprint, placementProblem, isMultiTile } from './shapes'
import { previewPlacement, calcStatTotal } from './playerState'
import { cellEdgeKeys, isEdgeInLimits, isEdgeInBounds, isEdgeInsideBuilding, instanceAt, addRoadEdge, edgeNodes, edgeKey } from './cityGrid'
import { buildingFamily } from '../cards/combine'

const SAME_KIND = 0.8 // per neighbour of the same family: districts
const ANY_NEIGHBOUR = 0.15 // per neighbour at all: a compact town
const NEW_STREET = 0.4 // per street segment the city has to lay to get there
const FROM_CENTRE = 0.05 // per plot from the middle of the city limits

/** What one more of each stat is worth to this city right now. */
export function needs (state) {
  const population = calcStatTotal(state, 'population')
  const jobs = calcStatTotal(state, 'jobs')
  return {
    population: jobs > population ? 1.2 : 0.8,
    jobs: population > jobs ? 1.2 : 0.3, // idle workers turn to crime (turn/phases.js unemployment)
    revenue: 1,
    patience: 3
  }
}

function neighbourInstances (state, cells) {
  const grid = state.cityGrid
  const own = new Set(cells.map(c => `${c.x},${c.y}`))
  const ids = new Set()
  for (const c of cells) {
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const x = c.x + dx; const y = c.y + dy
      if (own.has(`${x},${y}`) || x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue
      const id = instanceAt(grid, x, y)
      if (id) ids.add(id)
    }
  }
  return [...ids].map(id => state.builtStructures.find(i => i.instanceId === id)).filter(Boolean)
}

const MAX_STREETS = 4 // the longest new street the city will lay to reach a plot

/**
 * How far every street corner is from the network, by new segments, and the
 * way back (a breadth-first walk along edges a street may go on). Streets
 * may run between two buildings, never through one.
 */
function streetReach (state) {
  const grid = state.cityGrid
  const dist = new Map(); const via = new Map(); const queue = []
  for (const key of grid.roads) for (const [x, y] of edgeNodes(key)) { const n = `${x},${y}`; if (!dist.has(n)) { dist.set(n, 0); queue.push([x, y]) } }
  while (queue.length) {
    const [x, y] = queue.shift()
    const d = dist.get(`${x},${y}`)
    if (d >= MAX_STREETS) continue
    for (const [key, nx, ny] of [[edgeKey('h', x, y), x + 1, y], [edgeKey('h', x - 1, y), x - 1, y], [edgeKey('v', x, y), x, y + 1], [edgeKey('v', x, y - 1), x, y - 1]]) {
      const n = `${nx},${ny}`
      if (dist.has(n) || grid.roads.has(key) || !isEdgeInBounds(grid, key) || !isEdgeInLimits(grid, key) || isEdgeInsideBuilding(grid, key)) continue
      dist.set(n, d + 1); via.set(n, [key, `${x},${y}`]); queue.push([nx, ny])
    }
  }
  return { dist, via }
}

/** The new street segments from the network to this corner, nearest first. */
function pathTo (reach, node) {
  const out = []
  for (let n = node; reach.via.has(n);) { const [key, from] = reach.via.get(n); out.push(key); n = from }
  return out
}

/**
 * The street segments this footprint would need: none if it fronts one, else
 * the shortest new street out to it (MAX_STREETS at most), else null.
 */
function streetsFor (state, cells, reach) {
  const grid = state.cityGrid
  const own = new Set(cells.map(c => `${c.x},${c.y}`))
  const outer = []
  for (const c of cells) {
    for (const [side, key] of Object.entries(cellEdgeKeys(c.x, c.y))) {
      const [dx, dy] = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[side]
      if (!own.has(`${c.x + dx},${c.y + dy}`)) outer.push(key)
    }
  }
  if (outer.some(k => grid.roads.has(k))) return []
  let best = null
  for (const key of outer) {
    if (!isEdgeInBounds(grid, key) || !isEdgeInLimits(grid, key) || isEdgeInsideBuilding(grid, key)) continue
    for (const node of edgeNodes(key).map(([x, y]) => `${x},${y}`)) {
      const d = reach.dist.get(node)
      if (d == null || d + 1 > MAX_STREETS) continue
      if (!best || d + 1 < best.length) best = [...pathTo(reach, node).reverse(), key]
    }
  }
  return best
}

/**
 * The best spot for `card`: { x, y, rotation, streets, score }, or null when
 * nothing fits anywhere. Deterministic: ties go to the spot nearest the middle.
 */
export function choosePlacement (state, card) {
  const grid = state.cityGrid
  const l = grid.limits ?? { x0: 0, y0: 0, x1: grid.width, y1: grid.height }
  const cx = (l.x0 + l.x1 - 1) / 2; const cy = (l.y0 + l.y1 - 1) / 2
  const weight = needs(state)
  const family = buildingFamily(card)
  const free = { ...card, skipsRoadRequirement: true } // streets are checked here, and laid if need be
  const turns = isMultiTile(card) ? [0, 1, 2, 3] : [0]
  const reach = streetReach(state)
  let best = null
  for (let y = l.y0; y < l.y1; y++) {
    for (let x = l.x0; x < l.x1; x++) {
      for (const rotation of turns) {
        if (placementProblem(state, free, { x, y }, rotation)) continue
        const cells = footprint(card, { x, y }, rotation)
        const streets = card.skipsRoadRequirement ? [] : streetsFor(state, cells, reach)
        if (!streets) continue
        const p = previewPlacement(state, card, { x, y }, rotation)
        let score = 0
        for (const [k, v] of Object.entries(p.delta)) score += v * (weight[k] ?? 0)
        const near = neighbourInstances(state, cells)
        score += near.filter(n => buildingFamily(n.card) === family).length * SAME_KIND
        score += near.length * ANY_NEIGHBOUR
        score -= streets.length * NEW_STREET
        const mx = cells.reduce((n, c) => n + c.x, 0) / cells.length; const my = cells.reduce((n, c) => n + c.y, 0) / cells.length
        const dist = Math.abs(mx - cx) + Math.abs(my - cy)
        score -= dist * FROM_CENTRE
        if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && dist < best.dist)) best = { x, y, rotation, streets, score, dist }
      }
    }
  }
  if (!best) return null
  return { x: best.x, y: best.y, rotation: best.rotation, streets: best.streets, score: best.score }
}

/** Lay the streets a chosen spot needs. */
export function layStreets (state, streets = []) {
  for (const key of streets) addRoadEdge(state.cityGrid, key)
}
