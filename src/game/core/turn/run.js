// THE RUN: three eras, each ending in an election judged on a Mandate the
// player chose; the clock is Public Patience (Matt, 2026-10-29: "three
// eras, and each era has a big goal... the inevitability of it... more
// thematic than [turns], especially then we could have buildings that could
// delay the approach of the end of the era").
//
// state.run = {
//   era, status: 'choosing' | 'playing' | 'won' | 'lost' | 'endless',
//   patience, patienceStart, offer: [mandate], mandate, lastDrain: {...},
//   elections: [{ era, mandate, passed, early, turn }], election (the last one, for the screen)
// }
// The run config (createGame's `run`): { eras: [{ patience, limits, cardIds, costRise }], drain: {...} }.

import { evaluateCondition } from '../conditions/conditionRegistry'
import { calcStatTotal, countCardsByTag, sumPassive } from '../state/playerState'
import { addToDrawPile, shuffle } from '../piles/deck'
import { mandatesOfEra } from '../cards/mandates'
import { jamDrain } from '../state/traffic'
import { policyById, policyMod, policyPatience, queuePolicyPick, nextPolicyPick, restockPolicy, MILESTONES } from '../cards/policies'

export const DEFAULT_DRAIN = {
  base: 2, // every turn
  floor: 2, // civic pride can slow the drain to this, never below
  perBadCards: 6, // +1 for every N status cards in your deck...
  maxBad: 5, // ...up to this much a turn
  unemployment: 2, // a turn with more people than jobs
  disaster: 5, // a turn a disaster strikes
  chance: 2 // +0..chance at random: the mood of the town
}

function offer (ctx, era) {
  const pool = [...mandatesOfEra(era)]
  const rng = ctx.state.deck.rng
  const picks = []
  while (pool.length && picks.length < (ctx.run.offerSize ?? 2)) picks.push(pool.splice(Math.floor(rng() * pool.length), 1)[0])
  return picks
}

function enterEra (ctx, era, carry = 0) {
  const cfg = ctx.run.eras[era - 1]
  const run = ctx.state.run
  run.era = era
  run.patienceStart = cfg.patience + carry
  run.patience = run.patienceStart
  run.offer = offer(ctx, era)
  run.mandate = null
  run.status = 'choosing'
  // A policy to pick, one of three: at the start, and after every election won.
  if (ctx.run.policies) {
    queuePolicyPick(ctx.state, ctx.state.deck.rng, era === 1 ? 'A new administration' : 'Re-elected', { first: era === 1 })
    restockPolicy(ctx.state, ctx.state.deck.rng) // a new one for sale each era
  }
  ctx.state.disasterTimer.strikes = 0 // disasters escalate within an era, not across the run
  if (cfg.limits) ctx.state.cityGrid.limits = { ...cfg.limits }
  ctx.state.costRise = cfg.costRise ?? 0 // every building costs this much more to build this era
  if (cfg.cardIds?.length && ctx.cityRow && era > 1) {
    addToDrawPile(ctx.cityRow.sourceDeck, cfg.cardIds.map(id => ctx.catalog[id]).filter(Boolean))
    shuffle(ctx.cityRow.sourceDeck)
    ctx.log?.push(`Era ${era}: the city limits widen, new buildings come to market, and every building costs ${cfg.costRise ?? 0} more to build.`)
  }
}

export function createRun (ctx) {
  ctx.state.run = { era: 1, status: 'choosing', patience: 0, patienceStart: 0, offer: [], mandate: null, lastDrain: null, elections: [], election: null }
  enterEra(ctx, 1)
  return ctx.state.run
}

/** Take one of the policies on offer: it stands for the rest of the run. */
export function choosePolicy (ctx, policyId) {
  const run = ctx.state.run
  const policy = (run?.policyOffer ?? []).find(p => p.id === policyId)
  if (!policy) throw new Error(`Policy "${policyId}" is not on offer`)
  ctx.state.policies = [...(ctx.state.policies ?? []), policyById(policy.id)]
  run.policyOffer = []
  if (ctx.state.policyForSale?.id === policy.id) restockPolicy(ctx.state, ctx.state.deck.rng)
  nextPolicyPick(ctx.state, ctx.state.deck.rng)
  ctx.log?.push(`Policy adopted: ${policy.name}.`)
  return policy
}

export function chooseMandate (ctx, mandateId) {
  const run = ctx.state.run
  if (!run || run.status !== 'choosing') throw new Error('No mandate to choose right now')
  const mandate = run.offer.find(x => x.id === mandateId)
  if (!mandate) throw new Error(`Mandate "${mandateId}" was not offered`)
  run.mandate = mandate
  run.offer = []
  run.status = 'playing'
  run.election = null
  ctx.log?.push(`Mandate for era ${run.era}: ${mandate.name}.`)
  return mandate
}

export const mandateMet = (ctx) => !!ctx.state.run?.mandate && evaluateCondition(ctx.state.run.mandate.condition, { state: ctx.state, catalog: ctx.catalog })

/** The election: the mandate is judged; pass and the next era opens, fail and the run is over. */
export function holdElection (ctx, early = false) {
  const run = ctx.state.run
  const passed = mandateMet(ctx)
  const record = { era: run.era, mandate: run.mandate, passed, early, turn: ctx.turnManager.turnNumber + 1, patienceLeft: run.patience }
  run.elections.push(record)
  run.election = record
  if (!passed) {
    run.status = 'lost'
    ctx.state.gameStatus = 'lost'
    ctx.log?.push(`Election: the mandate (${run.mandate.name}) was not met. The city votes you out.`)
    return record
  }
  ctx.log?.push(`Election: ${run.mandate.name} met. Era ${run.era} is won.`)
  if (run.era >= ctx.run.eras.length) {
    run.status = 'won'
    ctx.state.gameStatus = 'won'
    return record
  }
  // Calling it early carries half the patience left into the next era.
  enterEra(ctx, run.era + 1, early ? Math.floor(Math.max(0, run.patience) / 2) : 0)
  return record
}

export function callElection (ctx) {
  const run = ctx.state.run
  if (!run || run.status !== 'playing') throw new Error('No election to call')
  if (!mandateMet(ctx)) throw new Error(`The mandate (${run.mandate.name}) is not met yet`)
  return holdElection(ctx, true)
}

export function goEndless (ctx) {
  const run = ctx.state.run
  if (!run || run.status !== 'won') throw new Error('Win the run first')
  run.status = 'endless'
  ctx.state.gameStatus = 'playing'
  ctx.log?.push('Endless city: no more elections. Build.')
}

/** A policy pick for every population mark passed (cards/policies.js MILESTONES), each once a run. */
function checkMilestones (ctx) {
  const run = ctx.state.run
  const pop = calcStatTotal(ctx.state, 'population')
  run.milestones ??= []
  for (const mark of MILESTONES) {
    if (pop < mark || run.milestones.includes(mark)) continue
    run.milestones.push(mark)
    queuePolicyPick(ctx.state, ctx.state.deck.rng, `${mark} people`)
    ctx.log?.push(`The city passes ${mark} people: the council offers a policy.`)
  }
}

/**
 * The end of a turn: patience drains by the city's state, and an election
 * is held when it runs out. Returns the drain's parts for the overnight card.
 */
export function drainPatience (ctx, { struck = false } = {}) {
  const run = ctx.state.run
  if (!run || run.status !== 'playing') return null
  if (ctx.run.policies) checkMilestones(ctx)
  const d = { ...DEFAULT_DRAIN, ...(ctx.run.drain ?? {}) }
  const bad = countCardsByTag(ctx.state, 'negative')
  const parts = []
  const add = (label, n) => { if (n) parts.push([label, n]) }
  add('time', d.base)
  add(`${bad} bad cards in your deck`, Math.min(d.maxBad, Math.floor(bad / d.perBadCards)))
  if (!policyMod(ctx.state, 'noUnemployment') && calcStatTotal(ctx.state, 'population') > calcStatTotal(ctx.state, 'jobs')) add('unemployment', d.unemployment) // Job Guarantee
  if (struck) add('disaster', d.disaster)
  add('the mood of the town', Math.floor(ctx.state.deck.rng() * (d.chance + 1)))
  add('policies', policyMod(ctx.state, 'drainMore')) // Night Economy
  add('traffic jams', jamDrain(ctx.state)) // state/traffic.js
  // Civic pride slows the clock but never stops it: the drain can't fall below the floor.
  const floor = Math.max(1, d.floor - policyMod(ctx.state, 'drainLess')) // Civic Pride Campaign
  const gross = parts.reduce((n, [, v]) => n + v, 0) - policyMod(ctx.state, 'drainLess')
  const pride = Math.min(sumPassive(ctx.state, 'patience') + policyPatience(ctx.state), Math.max(0, gross - floor))
  add('parks, culture and civic pride', -pride)
  add('Civic Pride Campaign', -policyMod(ctx.state, 'drainLess'))
  const total = parts.reduce((n, [, v]) => n + v, 0)
  run.patience = Math.min(run.patienceStart, run.patience - total)
  run.lastDrain = { total, parts }
  ctx.log?.push(`Patience ${total >= 0 ? '−' : '+'}${Math.abs(total)} (${parts.map(([l, v]) => `${l} ${v > 0 ? '−' : '+'}${Math.abs(v)}`).join(', ')}): ${Math.max(0, run.patience)} left.`)
  if (run.patience <= 0) holdElection(ctx)
  return run.lastDrain
}
