// TRAFFIC (Matt, 2026-10-29: "it would be cool to have traffic represented
// somehow... it's an important part of a city builder"). Kept simple and
// spatial, so where things go matters:
//
//   - every building makes TRIPS: half its people and jobs, rounded up;
//   - its trips leave by the streets on its outside edges, shared evenly;
//   - a street segment carries LANE_CAPACITY a lane (a Road is one lane, a
//     Boulevard two, a Highway three - grid.lanes, set when laid);
//   - a transit building (not a freight yard) adds capacity to every
//     street within two plots of it: 2, 4 or 6 by tier;
//   - a segment carrying more than it can is JAMMED. Jams drain Public
//     Patience (turn/run.js): 1 a turn per JAMS_PER_PATIENCE jams, the
//     first one counting at once (so a jam is felt), up to MAX_JAM_DRAIN.

import { cellEdgeKeys, parseEdgeKey } from './cityGrid'
import { instanceStats, cellsOf } from './playerState'
import { footprint } from './shapes'
import { policyMod } from '../cards/policies'

export const LANE_CAPACITY = 4
export const JAMS_PER_PATIENCE = 3
export const MAX_JAM_DRAIN = 4

/** A building's trips: half its people and jobs, rounded up. */
export function tripsOf (state, instance) {
  const t = instanceStats(state, instance).total
  return Math.ceil(((t.population ?? 0) + (t.jobs ?? 0)) / 2)
}

/** The streets on a building's outside edges. */
function frontage (grid, instance) {
  const cells = cellsOf(instance)
  const count = new Map()
  for (const c of cells) for (const k of Object.values(cellEdgeKeys(c.x, c.y))) count.set(k, (count.get(k) ?? 0) + 1)
  return [...count].filter(([k, n]) => n === 1 && grid.roads.has(k)).map(([k]) => k)
}

/** Distance in plots from an edge's middle to a cell's middle. */
function edgeToCell (key, c) {
  const { kind, x, y } = parseEdgeKey(key)
  const ex = kind === 'h' ? x + 0.5 : x
  const ey = kind === 'h' ? y : y + 0.5
  return Math.abs(ex - (c.x + 0.5)) + Math.abs(ey - (c.y + 0.5))
}

const isTransit = (card) => (card.tags ?? []).includes('transit') && !(card.tags ?? []).includes('industrial')

/**
 * The city's traffic now: { load, capacity } per street edge key, the
 * jammed edges, and the total trips.
 */
export function computeTraffic (state) {
  const grid = state.cityGrid
  const load = new Map()
  let trips = 0
  for (const inst of state.builtStructures) {
    const n = tripsOf(state, inst)
    if (!n) continue
    const out = frontage(grid, inst)
    if (!out.length) continue
    trips += n
    for (const k of out) load.set(k, (load.get(k) ?? 0) + n / out.length)
  }
  const transit = state.builtStructures.filter(i => isTransit(i.card))
  const capacity = new Map()
  for (const k of grid.roads) {
    let cap = (grid.lanes?.[k] ?? 1) * LANE_CAPACITY + policyMod(state, 'laneBonus') // One-Way Streets
    const relief = policyMod(state, 'trafficRelief') // Rapid Transit
    for (const t of transit) if (cellsOf(t).some(c => edgeToCell(k, c) <= 2)) cap += 2 * (t.card.tier ?? 1) + relief
    capacity.set(k, cap)
  }
  const jammed = [...grid.roads].filter(k => (load.get(k) ?? 0) > capacity.get(k))
  return { load, capacity, jammed, trips }
}

/** Patience lost to jams this turn (none under a Congestion Charge). */
export function jamDrain (state) {
  if (policyMod(state, 'jamToll')) return 0
  return Math.min(MAX_JAM_DRAIN, Math.ceil(computeTraffic(state).jammed.length / JAMS_PER_PATIENCE))
}

/** Budget the Congestion Charge raises: 1 a jammed street. */
export function jamToll (state) {
  return policyMod(state, 'jamToll') ? computeTraffic(state).jammed.length : 0
}

/**
 * Jammed streets now and if `card` were built at `position` (for the
 * aiming preview). Stands the building in for a moment, always takes it out.
 */
export function jamsIfBuilt (state, card, position, rotation = 0) {
  const before = computeTraffic(state).jammed.length
  const grid = state.cityGrid
  const cells = footprint(card, position, rotation).filter(c => c.x >= 0 && c.y >= 0 && c.x < grid.width && c.y < grid.height)
  const probe = { instanceId: '__traffic__', card, position, cells }
  const idx = cells.map(c => c.y * grid.width + c.x)
  const was = idx.map(i => grid.cells[i])
  state.builtStructures.push(probe)
  for (const i of idx) grid.cells[i] = probe.instanceId
  try {
    return { before, after: computeTraffic(state).jammed.length }
  } finally {
    state.builtStructures.pop()
    idx.forEach((i, k) => { grid.cells[i] = was[k] })
  }
}
