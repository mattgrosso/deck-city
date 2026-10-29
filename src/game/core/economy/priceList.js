// THE PRICE LIST: every card in Deck City priced in budget by the tables in
// economy.js. Pure; never imported by the game itself - tools/price.mjs and
// economy.test.js read it. Two transactions are priced separately:
//   play - paying a card's `cost` to build it once (or to resolve it);
//   buy  - paying a market card's `price` to put it in your deck.
// Things it cannot price from their data say so (`note`) rather than guess.

import {
  VALUE, HORIZON, CYCLE, CLEARS_PER_TURN, STRIKE_EVERY, FAIR, BARGAINS, TAGGED_PLAYS, CARD_SLOT,
  valueOfStats, valueOfEffects, valueOfEffect, valueOfAdjacency, ratio
} from './economy'
import { CITY_CARDS, TOKEN_CATALOG } from '../cards/cityCards'
import { STARTER_CARD_CATALOG, STARTER_DECK_CARDS } from '../cards/starterCards'
import { FACILITY_CATALOG } from '../cards/facilityCards'
import { GOAL_CATALOG } from '../cards/goalCards'
import { DISASTER_CATALOG } from '../cards/disasterCards'

const round2 = (n) => Math.round(n * 100) / 100
const flag = (key, r) => (BARGAINS[key] ? 'bargain' : (r < FAIR.low ? 'loss' : (r > FAIR.high ? 'deal' : 'fair')))

/** What a disaster card does to you: its bite, once, and a dead card in that hand. It is gone after. */
export function valueOfDisaster (card) {
  const once = Object.values(card.effects ?? {}).flat().reduce((n, e) => n + valueOfEffect(e, CATALOG), 0)
  return round2(once + VALUE.status / 2)
}
const AVERAGE_DISASTER = () => DISASTER_CATALOG.reduce((n, c) => n + valueOfDisaster(c), 0) / DISASTER_CATALOG.length

/** Every card a price can refer to (token effects look cards up by id). */
export const ALL_CARDS = [...STARTER_CARD_CATALOG, ...FACILITY_CATALOG, ...CITY_CARDS, ...TOKEN_CATALOG, ...GOAL_CATALOG, ...DISASTER_CATALOG]
export const CATALOG = Object.fromEntries(ALL_CARDS.map(c => [c.id, c]))
/** Every card that can turn up in the city row. */
export const MARKET_CARDS = [...FACILITY_CATALOG, ...CITY_CARDS]

/** What building a card once is worth, with the parts that add up to it. */
export function valueOfBuild (card) {
  const parts = []
  const add = (label, v) => { if (v) parts.push([label, round2(v)]) }
  add('stats', valueOfStats(card.stats))
  add('next door', valueOfAdjacency(card))
  add('effects', valueOfEffects(card.effects, CATALOG))
  const kinds = Array.isArray(card.clears) ? card.clears : (card.clears ? [card.clears] : [])
  if (kinds.length) {
    const capacity = card.slots?.capacity ?? 1
    const perTurn = Math.min(capacity, CLEARS_PER_TURN * kinds.length) + 0.1 * (capacity - 1)
    add(`clears ${kinds.join('/')}`, perTurn * HORIZON * -VALUE.status)
  }
  if (card.blocksDisasters) add('blocks disasters', Number(card.blocksDisasters) * (HORIZON / STRIKE_EVERY) * -AVERAGE_DISASTER())
  if (card.patience) add('patience', card.patience * VALUE.patience * HORIZON)
  if (card.handSizeBonus) add('bigger hand', card.handSizeBonus * VALUE.draw * HORIZON)
  if (card.buysBonus) add('more buys', card.buysBonus * VALUE.buy * HORIZON)
  for (const d of (Array.isArray(card.discount) ? card.discount : (card.discount ? [card.discount] : []))) add(`${d.tag} cheaper`, d.amount * TAGGED_PLAYS * HORIZON)
  if (card.placesRoad) add('opens plots', (card.roadSegments ?? 1) * 2 * 0.5) // ~2 new plots a segment, a plot's access ~0.5
  return { value: round2(parts.reduce((n, [, v]) => n + v, 0)), parts }
}

/** What a card's play costs in budget: its cost, plus a hand slot for a civic action. */
export const playCostOf = (card) => (card.cost ?? 0) + (card.type === 'civic' ? CARD_SLOT : 0)

/** Every card you can PLAY: its cost against what one play gives. */
export function pricePlays () {
  const cards = [...STARTER_CARD_CATALOG, ...MARKET_CARDS].filter(c => (c.type === 'building' || c.type === 'civic') && !c.token)
  return cards.map(card => {
    const key = `play:${card.id}`
    const { value, parts } = valueOfBuild(card)
    const cost = playCostOf(card)
    const r = ratio(value, cost)
    return { key, id: card.id, name: card.name, tier: card.tier ?? 1, cost, gain: value, ratio: r, flag: flag(key, r), note: parts.map(([l, v]) => `${l} ${v}`).join(', ') }
  })
}

/**
 * Every card you can BUY from the city row. Buying is half a transaction:
 * you pay its `price` at the market, then its `cost` again to build it. So
 * the trade is the pair - one build (and a spare copy in the deck, 0.5) for
 * price + cost. Before 2026-10-29 the market charged the play cost, so a
 * facility cost double and the price list called every one a loss.
 */
export function priceBuys () {
  return MARKET_CARDS.map(card => {
    const key = `buy:${card.id}`
    const { value } = valueOfBuild(card)
    const price = card.price ?? card.cost ?? 0
    const total = price + playCostOf(card)
    const gain = round2(value + 0.5)
    const r = ratio(gain, total)
    return { key, id: card.id, name: card.name, cost: price, play: card.cost ?? 0, gain, ratio: r, flag: flag(key, r), note: `buy ${price} + build ${card.cost ?? 0} for one build worth ${value}, and a spare` }
  })
}

/**
 * Goals are free; what they give is the reward. A claimed goal is a Monument
 * card in your deck, worth one build every CYCLE turns over the horizon.
 * The rewards should rise with the tier - flagged when a goal is far off its
 * tier's average.
 */
export function priceGoals () {
  const rows = GOAL_CATALOG.map(goal => {
    const now = valueOfEffects(goal.effects, CATALOG)
    const monument = round2(valueOfStats(goal.stats) * (HORIZON / CYCLE))
    return { key: `goal:${goal.id}`, id: goal.id, name: goal.name, tier: goal.tier ?? 1, now, monument, gain: round2(now + monument) }
  })
  const byTier = {}
  rows.forEach(r => { (byTier[r.tier] ??= []).push(r.gain) })
  const mean = Object.fromEntries(Object.entries(byTier).map(([t, xs]) => [t, xs.reduce((a, b) => a + b, 0) / xs.length]))
  return rows.map(r => {
    const off = Math.abs(r.gain - mean[r.tier]) / mean[r.tier]
    return { ...r, tierMean: round2(mean[r.tier]), flag: BARGAINS[r.key] ? 'bargain' : off > 0.3 ? 'off' : 'fair' }
  })
}

/** What the game does to you: status cards, disasters, unemployment. Information, not a trade. */
export function priceThreats () {
  return [
    ...STARTER_CARD_CATALOG.filter(c => c.type === 'status').map(c => ({ key: `threat:${c.id}`, name: `${c.name} card in your deck`, value: VALUE.status, note: 'a dead draw about every CYCLE turns until cleared' })),
    ...DISASTER_CATALOG.map(c => ({ key: `threat:${c.id}`, name: `${c.name} card in your deck`, value: valueOfDisaster(c), note: 'its bite, once, when drawn, and a dead card in that hand; then it is gone' })),
    { key: 'threat:unemployment', name: 'A turn with more people than jobs', value: VALUE.status, note: 'one Crime card' }
  ]
}

/** Everything, priced. */
export function priceList () {
  return { plays: pricePlays(), buys: priceBuys(), goals: priceGoals(), threats: priceThreats() }
}

/** Every priced thing off the line that is not a named bargain. */
export function offTheLine (list = priceList()) {
  return [...list.plays, ...list.buys, ...list.goals].filter(x => x.flag === 'loss' || x.flag === 'deal' || x.flag === 'off')
}

/** The starting deck, valued: what you open the game holding. */
export function valueOfStartingDeck () {
  const byId = Object.fromEntries(STARTER_CARD_CATALOG.map(c => [c.id, c]))
  return round2(STARTER_DECK_CARDS.reduce((n, id) => n + valueOfBuild(byId[id]).value - (byId[id].cost ?? 0), 0))
}
