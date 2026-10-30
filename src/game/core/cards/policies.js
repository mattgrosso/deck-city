// POLICIES - the run's relics (Matt, 2026-10-29: "it would be cool to have
// essentially like relics. We talked about them as policies"). A policy is
// a standing rule for the rest of the run, picked one of three: at the
// start of a run, and after every election won (turn/run.js).
//
// A policy is data: `mods` are numbers the engine adds in at fixed points
// (policyMod below), `rules` are stat bonuses for buildings with a tag
// (read by instanceStats). Most help; a few trade one thing for another.

export const POLICIES = [
  { id: 'tax-reform', name: 'Tax Reform', text: '+2 budget every turn.', mods: { budget: 2 } },
  { id: 'free-market', name: 'Free Market', text: '+1 buy every turn.', mods: { buys: 1 } },
  { id: 'bigger-council', name: 'Bigger Council', text: 'Draw 1 more card every turn.', mods: { handSize: 1 }, rare: true },
  { id: 'zoning-reform', name: 'Zoning Reform', text: 'Combining costs 2 less.', mods: { combineDiscount: 2 } },
  { id: 'street-grid', name: 'Street Grid Act', text: 'Every Road lays 1 more segment.', mods: { roadSegments: 1 } },
  { id: 'rent-control', name: 'Rent Control', text: 'Homes pay no upkeep.', mods: { upkeepFreeTags: ['residential'] } },
  { id: 'infrastructure-bond', name: 'Infrastructure Bond', text: '4 more buildings run free of upkeep.', mods: { upkeepFree: 4 } },
  { id: 'main-street', name: 'Main Street Program', text: 'Every shop: +1 revenue.', rules: [{ tags: ['commercial'], stat: 'revenue', amount: 1 }] },
  { id: 'housing-first', name: 'Housing First', text: 'Every home: +1 people.', rules: [{ tags: ['residential'], stat: 'population', amount: 1 }] },
  { id: 'industrial-subsidy', name: 'Industrial Subsidy', text: 'Factories cost 2 less to build.', mods: { discount: [{ tag: 'industrial', amount: 2 }] } },
  { id: 'green-belt-law', name: 'Green Belt Law', text: 'Every green space: +1 patience a turn.', mods: { patienceTags: [{ tag: 'green', amount: 1 }] } },
  { id: 'heritage-act', name: 'Heritage Act', text: 'Every Monument: +2 patience a turn.', mods: { patienceTags: [{ tag: 'monument', amount: 2 }] } },
  { id: 'civic-pride', name: 'Civic Pride Campaign', text: 'Patience drains 1 less every turn.', mods: { drainLess: 1 }, rare: true },
  { id: 'fire-code', name: 'Fire Code', text: 'Disasters come 2 turns later each time.', mods: { disasterDelay: 2 } },
  { id: 'recycling-mandate', name: 'Recycling Mandate', text: '+2 budget whenever you clear a bad card.', mods: { clearReward: 2 } },
  { id: 'bulk-buying', name: 'Bulk Buying', text: 'City row prices 1 less (never below 1).', mods: { priceDiscount: 1 } },
  { id: 'waterfront-plan', name: 'Waterfront Plan', text: 'Waterfront bonuses count double.', mods: { waterfrontMult: 2 } },
  { id: 'landmark-status', name: 'Landmark Status', text: 'Buildings on 2 or more plots: +1 revenue.', rules: [{ multiTile: true, stat: 'revenue', amount: 1 }] },
  { id: 'austerity', name: 'Austerity', text: '+4 budget every turn, but draw 1 fewer card.', mods: { budget: 4, handSize: -1 }, tradeoff: true },
  { id: 'night-economy', name: 'Night Economy', text: 'Leisure and culture: +2 revenue each. Patience drains 1 more every turn.', rules: [{ tags: ['leisure', 'culture', 'tourism'], stat: 'revenue', amount: 2 }], mods: { drainMore: 1 }, tradeoff: true }
]

export const policyById = (id) => POLICIES.find(p => p.id === id)

/** The sum of one numeric modifier across the city's policies (0 if none). */
export function policyMod (state, key) {
  return (state.policies ?? []).reduce((n, p) => n + (typeof p.mods?.[key] === 'number' ? p.mods[key] : 0), 0)
}

/** Every list-valued modifier of one key, joined (tags, discounts...). */
export function policyList (state, key) {
  return (state.policies ?? []).flatMap(p => p.mods?.[key] ?? [])
}

/** Stat bonuses policies give one building: [{ stat, amount, policy }]. */
export function policyRulesFor (state, instance) {
  const out = []
  const tags = instance.card.tags ?? []
  for (const p of state.policies ?? []) {
    for (const r of p.rules ?? []) {
      const hit = r.multiTile ? (instance.cells?.length ?? 1) > 1 : (r.tags ?? []).some(t => tags.includes(t))
      if (hit) out.push({ stat: r.stat, amount: r.amount, policy: p.name })
    }
  }
  return out
}

/** Patience a turn from policies that reward buildings with a tag. */
export function policyPatience (state) {
  let n = 0
  for (const { tag, amount } of policyList(state, 'patienceTags')) n += state.builtStructures.filter(i => (i.card.tags ?? []).includes(tag)).length * amount
  return n
}

/** Three policies the city doesn't have, by the game's rng; the first offer of a run leaves out the rare ones. */
export function offerPolicies (state, rng, { count = 3, first = false } = {}) {
  const owned = new Set((state.policies ?? []).map(p => p.id))
  const pool = POLICIES.filter(p => !owned.has(p.id) && !(first && p.rare))
  const picks = []
  while (pool.length && picks.length < count) picks.push(pool.splice(Math.floor(rng() * pool.length), 1)[0])
  return picks
}

// Prices the UI and the engine both read, with policies counted in.

/** What a card costs at the city row. */
export const marketPrice = (state, card) => Math.max(card.price ?? card.cost ?? 0 ? 1 : 0, (card.price ?? card.cost ?? 0) - policyMod(state, 'priceDiscount'))

/** How many street segments a Road card lays. */
export const roadSegmentsOf = (state, card) => (card.roadSegments ?? 2) + policyMod(state, 'roadSegments')
