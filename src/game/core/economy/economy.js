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
  // One more purchase at the city row this turn: the surplus of a fair buy
  // (about a spare copy's worth) plus getting the card a turn sooner.
  buy: 1.5,
  // A point of Public Patience: the era's clock. A turn costs ~3-4 of it
  // and a turn of building is worth a few budget, so a point is about 1.
  patience: 1,
  // Keeping up to N budget between turns: about 2 a turn kept, for HORIZON turns, at SPEND.
  rollover: 2 * HORIZON * SPEND
}

/** Of a city-wide count ("+1 for every shop in the city"): how many there tend to be. */
export const CITY_COUNT = 3

/** How often a building sees something built next door over the horizon. */
export const NEIGHBOUR_BUILDS = 1.5

/** Plays a turn of cards carrying a given tag (for discounts). */
export const TAGGED_PLAYS = 0.6

/**
 * What a hand slot is worth: playing a CIVIC card uses one of your five
 * cards for an action instead of a building, so civic plays pay it on top
 * of their cost. (Buildings are what a hand slot is for, so they don't.)
 */
export const CARD_SLOT = 1

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
  'play:street-permit': 'a one-use Road from the supply: cheap for the same reason, and gone once laid',
  'play:civic-recycle': 'free on purpose: the starter deck\'s filter, worth only what it digs past'
}

const round2 = (n) => Math.round(n * 100) / 100

/** Budget for a patch of stats ({ population: 2, revenue: 1, ... }). Unknown keys count nothing. */
export function valueOfStats (stats = {}) {
  return round2(Object.entries(stats).reduce((n, [k, v]) => n + (typeof v === 'number' ? v * (VALUE[k] ?? 0) : 0), 0))
}

/** Budget for one effect descriptor, firing once. `catalog` prices token cards. */
export function valueOfEffect (effect, catalog = {}) {
  const amount = effect.amount ?? 1
  switch (effect.type) {
    case 'gainTreasury': return amount
    case 'offerPolicy': return 8 // a pick of three policies: worth about a turn's spare budget
    case 'spendTreasury': return -amount
    case 'gainStatus': return amount * VALUE.status
    case 'consumeStatus': return -amount * VALUE.status
    case 'gainStatusPerAdjacent': return NEIGHBOURS.good * VALUE.status
    case 'drawCards': return amount * VALUE.draw
    case 'discardCards': return 2 * VALUE.discard
    case 'gainBuys': return amount * VALUE.buy
    case 'gainPatience': return amount * VALUE.patience
    case 'raiseTreasuryRolloverCap': return VALUE.rollover * Math.min(1, amount / 10)
    case 'gainTreasuryPerAdjacent': return amount * NEIGHBOURS.good
    case 'gainTreasuryPerCount': return amount * CITY_COUNT / (effect.per ?? 1)
    case 'gainTreasuryPerStatus': return amount * Math.min(effect.max ?? 3, 2)
    case 'clearAnyStatus': return amount * -VALUE.status * (effect.disasters ? 2 : 1)
    // A capped maker (`max`) only tops the deck back up as its tokens are
    // played, so a turn of it is worth about half a token.
    case 'gainCard': return amount * valueOfCardInDeck(catalog[effect.card], catalog) * (effect.max ? 0.5 : 1)
    case 'gainCardPerAdjacent': return NEIGHBOURS.good * valueOfCardInDeck(catalog[effect.card], catalog) * (effect.max ? 0.5 : 1)
    default: return 0
  }
}

/**
 * A card added to your deck: a token is played once (exhaust) for what its
 * effects give; a status card is a dead draw; anything else comes round
 * HORIZON / CYCLE times.
 */
export function valueOfCardInDeck (card, catalog = {}) {
  if (!card) return 0
  if (card.type === 'status' || card.type === 'disaster') return VALUE.status
  const once = valueOfEffects(card.effects, catalog) - (card.cost ?? 0)
  return round2(card.exhaust ? once : once * (HORIZON / CYCLE))
}

/** How many times a trigger fires over the horizon. */
export const TIMES = {
  onBuild: 1,
  onPlay: 1,
  onComplete: 1,
  onTurnStart: HORIZON,
  onDraw: HORIZON / CYCLE,
  onNeighborBuilt: NEIGHBOUR_BUILDS,
  onClear: 0.5 * HORIZON // CLEARS_PER_TURN x HORIZON
}

/** Budget for every effect on a card, counted by how often each trigger fires. */
export function valueOfEffects (effects = {}, catalog = {}) {
  return round2(Object.entries(effects).reduce((n, [trigger, list]) => n + (TIMES[trigger] ?? 1) * list.reduce((m, e) => m + valueOfEffect(e, catalog), 0), 0))
}

/** Budget for a card's "next door" rules, at the expected number of neighbours. */
export function valueOfAdjacency (card) {
  return round2((card.adjacency?.statBonus ?? []).reduce((n, b) => {
    const count = b.scope === 'city'
      ? Math.min(b.max ?? 99, CITY_COUNT) / (b.per ?? 1)
      : (b.amount > 0 ? NEIGHBOURS.good : NEIGHBOURS.bad)
    return n + b.amount * count * (VALUE[b.stat] ?? 0)
  }, 0))
}

/** How a gain compares with its cost: 1 is fair, above is a deal, below a loss. */
export const ratio = (gain, cost) => (cost > 0 ? round2(gain / cost) : (gain > 0 ? Infinity : 1))
