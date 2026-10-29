// THE ECONOMY: what everything in Deck City is worth, in BUDGET (Matt,
// 2026-10-29: "in Commonwealth we did a huge audit of all actions and
// prices and tried to unify them all behind a single core value... I want to
// do something similar here so that as we add new features and tweak things
// around we can have a unified and consistent economy").
//
// THE UNIT IS ONE BUDGET: one coin of this turn's treasury. It is the thing
// every card is paid with, and the thing every building's revenue becomes.
//
// Pure tables and arithmetic. `priceList.js` prices every card with them;
// `tools/price.mjs` writes docs/ECONOMY.md; economy.test.js FAILS when
// something new lands off the line without being a named BARGAIN. These are
// estimates, written down so they can be argued with - which is the point.
// Change a value here and every price moves with it.

/** How many turns a lasting effect (a building, a card in the deck) is counted over. */
export const HORIZON = 4

/**
 * How much of a point of revenue actually gets spent. Budget is use-it-or-
 * lose-it and you only hold five cards, so a point of revenue is not a
 * whole budget every turn - about 0.6 of one.
 */
export const SPEND = 0.6

/** Turns for the deck to come round once (about 10-12 cards, five a turn). */
export const CYCLE = 2

/** One of each, in budget. */
export const VALUE = {
  budget: 1,
  // A point of revenue, every turn for HORIZON turns, at SPEND.
  revenue: SPEND * HORIZON,
  // The win condition is 20; a lone house (3 budget, 2 people, 1 revenue,
  // a Crime card) is the anchor trade and should land fair.
  population: 1.5,
  // A job keeps one person out of the unemployment Crime; shared, so half.
  jobs: 0.5,
  // A dead card in the deck: a wasted draw about every CYCLE turns until cleared.
  status: -2,
  // A card drawn: one more choice this turn.
  draw: 1,
  // Choosing a card to discard: thinning a bad draw.
  discard: 0.5,
  // Keeping up to N budget between turns: about 2 a turn kept, for HORIZON turns, at SPEND.
  rollover: 2 * HORIZON * SPEND
}

/** Of a "next door" bonus: how many matching neighbours a player gets on average. */
export const NEIGHBOURS = { good: 1, bad: 0.5 } // players chase the good ones and dodge the bad

/** Status cards a facility actually clears a turn: it needs one in hand AND a free slot. */
export const CLEARS_PER_TURN = 0.5

/** How often a disaster strikes (turns), for valuing a Fire Station. */
export const STRIKE_EVERY = 4

/**
 * A trade is FAIR when what you get over what you pay sits in this band.
 * Off the line is a mistake unless it is a named bargain.
 */
export const FAIR = { low: 0.75, high: 1.4 }

/**
 * The deliberate breaks from the line - cheap or dear on purpose. Each says
 * WHY, so "this is cheap on purpose" and "this is cheap by accident" can
 * never be confused. Key = `play:<card id>` or `buy:<card id>`.
 */
export const BARGAINS = {
  'play:road': 'the city\'s skeleton: cheap so building never stalls for want of a street',
  'play:civic-recycle': 'free on purpose: the starter deck\'s filter, worth only what it digs past'
}

const round2 = (n) => Math.round(n * 100) / 100

/** Budget for a patch of stats ({ population: 2, revenue: 1, ... }). Unknown keys count nothing. */
export function valueOfStats (stats = {}) {
  return round2(Object.entries(stats).reduce((n, [k, v]) => n + (typeof v === 'number' ? v * (VALUE[k] ?? 0) : 0), 0))
}

/** Budget for one effect descriptor, firing once. */
export function valueOfEffect (effect) {
  const amount = effect.amount ?? 1
  switch (effect.type) {
    case 'gainTreasury': return amount
    case 'spendTreasury': return -amount
    case 'gainStatus': return amount * VALUE.status
    case 'consumeStatus': return -amount * VALUE.status
    case 'gainStatusPerAdjacent': return NEIGHBOURS.good * VALUE.status
    case 'drawCards': return amount * VALUE.draw
    case 'discardCards': return 2 * VALUE.discard
    case 'raiseTreasuryRolloverCap': return VALUE.rollover * Math.min(1, amount / 10)
    default: return 0
  }
}

/** How many times a trigger fires over the horizon. */
export const TIMES = {
  onBuild: 1,
  onPlay: 1,
  onComplete: 1,
  onTurnStart: HORIZON,
  onDraw: HORIZON / CYCLE
}

/** Budget for every effect on a card, counted by how often each trigger fires. */
export function valueOfEffects (effects = {}) {
  return round2(Object.entries(effects).reduce((n, [trigger, list]) => n + (TIMES[trigger] ?? 1) * list.reduce((m, e) => m + valueOfEffect(e), 0), 0))
}

/** Budget for a card's "next door" rules, at the expected number of neighbours. */
export function valueOfAdjacency (card) {
  return round2((card.adjacency?.statBonus ?? []).reduce((n, b) => n + b.amount * (b.amount > 0 ? NEIGHBOURS.good : NEIGHBOURS.bad) * (VALUE[b.stat] ?? 0), 0))
}

/** How a gain compares with its cost: 1 is fair, above is a deal, below a loss. */
export const ratio = (gain, cost) => (cost > 0 ? round2(gain / cost) : (gain > 0 ? Infinity : 1))
