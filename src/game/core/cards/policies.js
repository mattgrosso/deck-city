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
  { id: 'rent-control', name: 'Rent Control', text: 'Homes pay no upkeep.', mods: { upkeepFreeTags: ['residential'] } },
  { id: 'infrastructure-bond', name: 'Infrastructure Bond', text: '4 more buildings run free of upkeep.', mods: { upkeepFree: 4 } },
  { id: 'main-street', name: 'Main Street Program', text: 'Every shop: +1 revenue.', rules: [{ tags: ['commercial'], stat: 'revenue', amount: 1 }] },
  // Was Housing First (+1 people a home): self-play lost more to unemployment than it gained.
  { id: 'property-tax', name: 'Property Tax', text: 'Every home: +1 revenue.', rules: [{ tags: ['residential'], stat: 'revenue', amount: 1 }] },
  { id: 'industrial-subsidy', name: 'Industrial Subsidy', text: 'Factories cost 2 less to build.', mods: { discount: [{ tag: 'industrial', amount: 2 }] } },
  { id: 'green-belt-law', name: 'Green Belt Law', text: 'Every green space: +1 patience a turn.', mods: { patienceTags: [{ tag: 'green', amount: 1 }] } },
  { id: 'heritage-act', name: 'Heritage Act', text: 'Every Monument: +2 patience a turn.', mods: { patienceTags: [{ tag: 'monument', amount: 2 }] } },
  { id: 'civic-pride', name: 'Civic Pride Campaign', text: 'Patience drains 1 less every turn.', mods: { drainLess: 1 }, rare: true },
  { id: 'fire-code', name: 'Fire Code', text: 'Disasters come 2 turns later each time.', mods: { disasterDelay: 2 } },
  { id: 'recycling-mandate', name: 'Recycling Mandate', text: '+2 budget whenever you clear a bad card.', mods: { clearReward: 2 } },
  { id: 'bulk-buying', name: 'Bulk Buying', text: 'City row prices 1 less (never below 1).', mods: { priceDiscount: 1 } },
  { id: 'waterfront-plan', name: 'Waterfront Plan', text: 'Waterfront bonuses count double.', mods: { waterfrontMult: 2 } },
  { id: 'landmark-status', name: 'Landmark Status', text: 'Buildings on 2 or more plots: +1 revenue.', rules: [{ multiTile: true, stat: 'revenue', amount: 1 }] },
  { id: 'austerity', name: 'Austerity', text: '+5 budget every turn, but city row prices are 1 more.', mods: { budget: 5, priceDiscount: -1 }, tradeoff: true },
  { id: 'night-economy', name: 'Night Economy', text: 'Leisure and culture: +2 revenue and +1 patience a turn each.', rules: [{ tags: ['leisure', 'culture', 'tourism'], stat: 'revenue', amount: 2 }], mods: { patienceTags: [{ tag: 'leisure', amount: 1 }, { tag: 'culture', amount: 1 }] } },
  // More, so a run that earns ten of them still sees new ones (2026-10-29).
  { id: 'tourism-board', name: 'Tourism Board', text: 'Every landmark: +2 revenue.', rules: [{ tags: ['landmark'], stat: 'revenue', amount: 2 }] },
  { id: 'school-funding', name: 'School Funding', text: 'Every school: +2 people (families move in).', rules: [{ tags: ['education'], stat: 'population', amount: 2 }] },
  { id: 'sanitation-act', name: 'Sanitation Act', text: 'Every building that takes bad cards has room for 2 more.', mods: { slotBonus: 2 } }, // was +1 a turn, which Matt found "very powerful" (2026-10-31)
  { id: 'zoning-board', name: 'Planning Board', text: 'Buildings on 2 or more plots cost 2 less to build.', mods: { multiDiscount: 2 } },
  { id: 'land-trust', name: 'Land Trust', text: 'Green spaces cost 2 less to build.', mods: { discount: [{ tag: 'green', amount: 2 }] } },
  { id: 'enterprise-zone', name: 'Enterprise Zone', text: 'Every factory: +1 revenue.', rules: [{ tags: ['industrial'], stat: 'revenue', amount: 1 }] },
  { id: 'job-guarantee', name: 'Job Guarantee', text: 'Unemployment never drains patience.', mods: { noUnemployment: 1 } },
  { id: 'rainy-day-fund', name: 'Rainy Day Fund', text: 'Interest: +1 budget a turn for every 10 you have saved (up to +5).', mods: { interest: 1 } },
  { id: 'mass-housing', name: 'Mass Housing', text: 'Dense homes: +2 people each.', rules: [{ tags: ['dense'], stat: 'population', amount: 2 }] },
  { id: 'merchant-guild', name: 'Merchant Guild', text: '+1 budget every turn for every 3 shops.', mods: { budgetPer: [{ tag: 'commercial', per: 3 }] } },
  { id: 'arts-patronage', name: 'Arts Patronage', text: 'Every culture building: +1 patience a turn.', mods: { patienceTags: [{ tag: 'culture', amount: 1 }] } },
  { id: 'fast-track', name: 'Fast-Track Permits', text: 'Every building costs 1 less to build, but city row prices are 1 more.', mods: { costAll: 1, priceDiscount: -1 }, tradeoff: true },
  { id: 'big-government', name: 'Big Government', text: 'Draw 1 more card and +1 buy every turn, but patience drains 1 more every turn.', mods: { handSize: 1, buys: 1, drainMore: 1 }, tradeoff: true, rare: true }
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

// ---- earning policies (Matt: "you get more relics than that in Slay the
// Spire... relics should be something we can earn in other ways as well").
// A pick is one of three; picks that arrive while one is open wait their
// turn (run.policyQueue). Sources: the start of a run, every election won,
// population milestones, tier II and III goals, and the one for sale (one
// each era: it restocks when an era opens, not when it is bought).

/** Population marks that earn a policy, each once a run. */
export const MILESTONES = [30, 70, 130, 200, 300]

/** Queue a pick of three. `reason` heads the offer screen. */
export function queuePolicyPick (state, rng, reason, { first = false } = {}) {
  const run = state.run
  if (!run) return
  if (run.policyOffer?.length) { run.policyQueue = [...(run.policyQueue ?? []), reason]; return }
  run.policyOffer = offerPolicies(state, rng, { first })
  run.policyReason = reason
}

/** After a pick: the next one waiting, if any. */
export function nextPolicyPick (state, rng) {
  const run = state.run
  const reason = run.policyQueue?.shift()
  if (reason) { run.policyOffer = offerPolicies(state, rng); run.policyReason = reason }
}

/** What the policy for sale costs: dearer the more the city has. */
export const policyPrice = (state) => 10 + 4 * (state.policies?.length ?? 0)

/** Put a new policy up for sale (one the city doesn't have, not on offer). */
export function restockPolicy (state, rng) {
  const skip = new Set((state.run?.policyOffer ?? []).map(p => p.id))
  const pool = offerPolicies(state, rng, { count: 6 }).filter(p => !skip.has(p.id))
  state.policyForSale = pool[0] ?? null
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

/** How many bad cards a clearing building holds in all (Sanitation Act adds two). */
export const slotCapacity = (state, instance) => (instance.slots?.capacity ?? 0) + policyMod(state, 'slotBonus')

/** Budget a turn from policies: flat (Tax Reform) and per building (Merchant Guild). */
export function policyBudget (state) {
  let n = policyMod(state, 'budget')
  for (const { tag, per } of policyList(state, 'budgetPer')) n += Math.floor(state.builtStructures.filter(i => (i.card.tags ?? []).includes(tag)).length / per)
  return n
}

/** How many street segments a Road card lays. */
export const roadSegmentsOf = (state, card) => (card.roadSegments ?? 2) + policyMod(state, 'roadSegments')
