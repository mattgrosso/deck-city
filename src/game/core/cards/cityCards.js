// THE CITY: every building and civic card beyond the starter deck, in three
// tiers. Matt, 2026-10-29: "we need to have a much larger base of
// buildings, and probably they should be tiered... much more interesting
// building and card abilities so that we can find combinations that are
// exciting and novel... just go crazy."
//
// Tier I is on the market from the start; tiers II and III are shuffled
// into the city deck as the population grows (game.js `cityTiers`).
//
// COSTS ARE SET BY THE ECONOMY. `cost` is written by `yarn reprice`
// (tools/reprice.mjs), which prices each card in budget
// (src/game/core/economy) and writes the number that lands it on the line.
// Write a new card with `null` and run it. `price` (to buy it at the city
// row) follows from the cost.
//
// The vocabulary - every ability below is card data the engine already reads:
//   near: [nd(stat, n, tag)]       +n stat for EACH neighbour tagged tag (n may be negative)
//   near: [city(stat, n, tag)]     +n stat for each such building ANYWHERE in the city
//   onBuild / onTurn / onNeighbor / onClear: effects when built, every turn,
//                                  when something is built next door, when it clears a card
//   clears + slots                 play status cards from your hand into it
//   handSize / buysBonus           more cards drawn / more buys, every turn
//   discount: { tag, amount }      cards with that tag cost less to build
//   blocks                         disaster cards blocked per strike
//   unique                         only one may stand
//   patience: n                    +n Public Patience every turn (negative drains it)
//   onCity / onAnyClear / onToken  whenever you build anything / any bad card is cleared /
//                                  you play a token; wrap in only(tag, ...) to filter
//   onNth + every                  on every Nth card you play in a turn
//   onCombine                      whenever you combine two buildings
//   grow(stat, n, max)             this building keeps +n stat for good, up to max
//   growNb(tag, stat, n, max)      neighbours with the tag grow instead
//   near: [deck(stat, n, tag, max)] +n stat for each such card in your deck
//   freeFirst: tag                 the first building with that tag each turn costs 0
//
// THE ARCHETYPES (Matt, 2026-10-30: no tags for them, "they can just come
// from the effects"): garden suburbs (homes + green grow), industry (bad
// cards into money), tourism (token boosters), density (free firsts, every
// third card), and civic (clearing and combining pay).

import { CARD_TYPES } from './cardSchema'

const priceFor = (cost) => (cost == null ? null : Math.max(1, Math.round(cost * 0.35)))

/** A building. */
function B (id, name, tier, tags, cost, o = {}) {
  const card = { id, type: CARD_TYPES.BUILDING, name, tier, tags, cost, price: priceFor(cost), stats: o.stats ?? {} }
  if (o.near) card.adjacency = { statBonus: o.near }
  const effects = {}
  if (o.onBuild) effects.onBuild = o.onBuild
  if (o.onTurn) effects.onTurnStart = o.onTurn
  if (o.onNeighbor) effects.onNeighborBuilt = o.onNeighbor
  if (o.onClear) effects.onClear = o.onClear
  if (o.onCity) effects.onCityBuilt = o.onCity
  if (o.onAnyClear) effects.onAnyClear = o.onAnyClear
  if (o.onToken) effects.onTokenPlayed = o.onToken
  if (o.onNth) { effects.onNthPlay = o.onNth; card.every = o.every ?? 3 }
  if (o.onCombine) effects.onCombine = o.onCombine
  if (Object.keys(effects).length) card.effects = effects
  // `slots` is how many a turn it once took; it now holds three turns' worth in all, then it's full.
  if (o.clears) { card.clears = o.clears; card.slots = { capacity: (o.slots ?? 2) * 3 } }
  for (const k of ['handSize', 'buysBonus', 'discount', 'blocks', 'unique', 'flavor', 'patience', 'placesRoad', 'roadSegments', 'lanes', 'freeFirst']) if (o[k] !== undefined) card[k === 'handSize' ? 'handSizeBonus' : k === 'blocks' ? 'blocksDisasters' : k] = o[k]
  return card
}

/** A civic card: an action, resolved when played. */
function C (id, name, tier, cost, onPlay, o = {}) {
  return { id, type: CARD_TYPES.CIVIC, name, tier, tags: ['civic', ...(o.tags ?? [])], cost, price: priceFor(cost), effects: { onPlay }, ...(o.exhaust ? { exhaust: true } : {}), ...(o.flavor ? { flavor: o.flavor } : {}) }
}

/** A token: made by other cards, played once for free, then gone. */
function T (id, name, onPlay, flavor) {
  return { id, type: CARD_TYPES.CIVIC, name, tags: ['token'], cost: 0, token: true, exhaust: true, effects: { onPlay }, flavor }
}

const nd = (stat, amount, targetTag) => ({ stat, amount, targetTag })
const city = (stat, amount, targetTag, extra = {}) => ({ stat, amount, targetTag, scope: 'city', ...extra })
const gain = (amount) => ({ type: 'gainTreasury', amount })
const draw = (amount) => ({ type: 'drawCards', amount })
const buys = (amount) => ({ type: 'gainBuys', amount })
const status = (card, amount = 1) => ({ type: 'gainStatus', card, amount })
const clear = (amount, extra = {}) => ({ type: 'clearAnyStatus', amount, ...extra })
const token = (card, amount = 1) => ({ type: 'gainCard', card, amount })
const tokenPerAdj = (card, targetTag) => ({ type: 'gainCardPerAdjacent', card, targetTag, max: TOKEN_MAX })
// A token made EVERY turn stops once the deck holds TOKEN_MAX of it (self-play
// found decks of 400 Tourists: a Museum, a Zoo and a Stadium outrun any hand).
const TOKEN_MAX = 3
const tokenTurn = (card, amount = 1) => ({ type: 'gainCard', card, amount, max: TOKEN_MAX })
const perAdj = (targetTag, amount = 1) => ({ type: 'gainTreasuryPerAdjacent', targetTag, amount })
const perCount = (tag, amount = 1, per = 1) => ({ type: 'gainTreasuryPerCount', tag, amount, per })
const perStatus = (tag, amount = 1, max = 3) => ({ type: 'gainTreasuryPerStatus', tag, amount, max })
const deck = (stat, amount, targetTag, max) => ({ stat, amount, targetTag, scope: 'deck', max })
const pat = (amount = 1) => ({ type: 'gainPatience', amount })
const grow = (stat, amount, max) => ({ type: 'growSelf', stat, amount, max })
const growNb = (tag, stat, amount = 1, max = 3) => ({ type: 'growNeighbors', tag, stat, amount, max })
/** Only when the card built / cleared / played has this tag (or id). */
const only = (tag, ...effects) => effects.map(e => ({ ...e, ifTag: tag }))

// ------------------------------------------------------------------ tokens
// Tokens replace themselves (Matt: "I do really like 'do a thing and draw a
// card' cards"): a token drawn no longer costs a building its place in hand.
export const TOURIST = T('tourist', 'Tourist', [gain(2), draw(1)], 'Spends money, tells a friend, leaves.')
export const COMMUTER = T('commuter', 'Commuter', [draw(2)], 'Brings the news from across town.')
export const VOLUNTEER = T('volunteer', 'Volunteer', [clear(1), draw(1)], 'Picks up one mess, then goes home.')
export const INVESTOR = T('investor', 'Investor', [gain(1), buys(1)], 'Shows up with a chequebook.')
export const DEBT = { id: 'debt', type: CARD_TYPES.STATUS, name: 'Debt', tags: ['negative', 'debt'] }
export const TOKEN_CATALOG = [TOURIST, COMMUTER, VOLUNTEER, INVESTOR, DEBT]

// ============================================================ RESIDENTIAL
export const RESIDENTIAL_CARDS = [
  B('cottage', 'Cottage', 1, ['residential'], 5, { stats: { population: 1, revenue: 1 }, near: [nd('population', 1, 'green')], onCity: only('green', grow('population', 1, 3)), flavor: 'Roses by the door.' }),
  B('row-house', 'Row House', 1, ['residential'], 2, { stats: { population: 2 }, near: [nd('population', 1, 'residential')], onBuild: [status('crime')], flavor: 'Shares a wall, shares a street.' }),
  B('bungalow', 'Bungalow', 1, ['residential'], 5, { stats: { population: 2, revenue: 1 }, near: [nd('population', -1, 'commercial')], onCity: only('green', gain(1)), flavor: 'Quiet, please.' }),
  B('trailer-park', 'Trailer Park', 1, ['residential'], 2, { stats: { population: 4 }, onBuild: [status('crime'), status('trash')], flavor: 'Cheap, cheerful, a little loud.' }),
  B('duplex', 'Duplex', 1, ['residential'], 5, { stats: { population: 3, revenue: 1 }, onBuild: [status('crime')], onCombine: [grow('population', 1, 4)], flavor: 'Always room for one more.' }),
  B('garden-home', 'Garden Home', 1, ['residential'], 7, { stats: { population: 2 }, near: [nd('revenue', 1, 'green'), nd('population', 1, 'green')], onCity: only('green', gain(1)) }),
  B('farmhouse', 'Farmhouse', 1, ['residential', 'rural'], 7, { stats: { population: 1, jobs: 1, revenue: 1 }, near: [nd('revenue', 1, 'rural')], onCity: only('rural', grow('revenue', 1, 3)), flavor: 'Up before the roosters.' }),
  B('boarding-house', 'Boarding House', 1, ['residential'], 7, { stats: { population: 2 }, onTurn: [perAdj('commercial', 1)], onNeighbor: only('commercial', grow('population', 1, 3)), flavor: 'Rent is due Fridays.' }),
  B('company-housing', 'Company Housing', 1, ['residential'], 9, { stats: { population: 2 }, near: [nd('population', 2, 'industrial'), deck('revenue', 1, 'pollution', 3)], flavor: 'The whistle pays, whatever the air smells like.' }),
  B('student-dorm', 'Student Dorm', 1, ['residential', 'education'], 4, { stats: { population: 2 }, near: [nd('revenue', 1, 'education')], onCity: only('education', grow('population', 1, 3)), onBuild: [status('trash')] }),
  B('apartment-block', 'Apartment Block', 2, ['residential', 'dense'], 9, { stats: { population: 4, revenue: 1 }, near: [nd('population', 1, 'commercial')], onNth: [grow('population', 1, 4)], onBuild: [status('crime')] }),
  B('townhouses', 'Townhouses', 2, ['residential'], 13, { stats: { population: 3, revenue: 2 }, near: [nd('population', 1, 'residential')], freeFirst: 'residential', flavor: 'Builders on the block all year.' }),
  B('senior-living', 'Senior Living', 2, ['residential'], 8, { stats: { population: 3, jobs: 1 }, near: [nd('population', 1, 'health'), nd('population', 1, 'green')], onCity: only('green', pat(1)), flavor: 'Bingo on Tuesdays.' }),
  B('co-op-housing', 'Co-op Housing', 2, ['residential'], 7, { stats: { population: 3 }, onBuild: [clear(1)], onAnyClear: [grow('population', 1, 4)], flavor: 'Everyone brings a dish.' }),
  B('loft-conversions', 'Loft Conversions', 2, ['residential', 'arts'], 10, { stats: { population: 3, revenue: 1 }, near: [nd('population', 1, 'industrial'), nd('revenue', 1, 'culture')], onCity: only('industrial', grow('population', 1, 3)), flavor: 'Exposed brick, exposed pipes.' }),
  B('gated-community', 'Gated Community', 2, ['residential'], 10, { stats: { population: 3, revenue: 3 }, near: [nd('revenue', -1, 'residential')], onCity: only('luxury', grow('revenue', 1, 3)), flavor: 'Members only.' }),
  B('mixed-use-tower', 'Mixed-Use Tower', 2, ['residential', 'commercial', 'dense'], 11, { stats: { population: 2, jobs: 2, revenue: 2 }, onNth: [gain(2)], onBuild: [status('trash')], flavor: 'Counts as a house AND a shop.' }),
  B('housing-project', 'Housing Project', 2, ['residential', 'dense'], 1, { patience: -1, stats: { population: 6 }, onBuild: [status('crime', 2)] }),
  B('brownstones', 'Brownstones', 2, ['residential'], 11, { stats: { population: 3, revenue: 2 }, near: [nd('revenue', 1, 'culture')], onCity: only('culture', grow('population', 1, 3)) }),
  B('cul-de-sac', 'Cul-de-sac', 2, ['residential'], 7, { stats: { population: 4 }, near: [nd('population', 1, 'green'), nd('population', -1, 'commercial')], onCity: only('green', grow('population', 1, 4)), flavor: 'Kids play in the street.' }),
  B('high-rise', 'High-Rise', 3, ['residential', 'dense'], 15, { stats: { population: 7, revenue: 2 }, near: [nd('population', 1, 'commercial')], freeFirst: 'dense', onBuild: [status('crime'), status('trash')] }),
  B('penthouse-tower', 'Penthouse Tower', 3, ['residential', 'luxury'], 18, { stats: { population: 4, revenue: 4 }, near: [nd('revenue', 1, 'green')], onCity: only('landmark', grow('revenue', 2, 6)) }),
  B('arcology', 'Arcology', 3, ['residential', 'commercial', 'dense'], 15, { stats: { population: 8, jobs: 4, revenue: 2 }, unique: true, onNth: [draw(1)], onBuild: [status('trash', 2)], flavor: 'A city in a building.' }),
  B('garden-city-estate', 'Garden City Estate', 3, ['residential'], 10, { stats: { population: 5 }, near: [nd('population', 2, 'green')], onCity: only('green', growNb('residential', 'population', 1, 3)), flavor: 'Every new park lifts the whole street.' }),
  B('luxury-condos', 'Luxury Condos', 3, ['residential', 'luxury'], 18, { stats: { population: 5, revenue: 2 }, near: [city('revenue', 1, 'landmark')], onCity: only('luxury', grow('revenue', 1, 4)) })
]

// ============================================================= COMMERCIAL
export const COMMERCIAL_CARDS = [
  B('corner-store', 'Corner Store', 1, ['commercial'], 5, { stats: { jobs: 1, revenue: 1 }, near: [nd('revenue', 1, 'residential')], onNeighbor: only('residential', grow('revenue', 1, 3)) }),
  B('diner', 'Diner', 1, ['commercial', 'food'], 9, { stats: { jobs: 2, revenue: 1 }, onTurn: [perAdj('industrial', 1)], onToken: [gain(1)], flavor: 'Whoever walks in, orders pie.' }),
  B('barber', 'Barber Shop', 1, ['commercial'], 6, { stats: { jobs: 1, revenue: 1 }, onBuild: [draw(1)], onNth: [gain(1)], flavor: 'All the gossip, free with a trim.' }),
  B('market-stall', 'Market Stall', 1, ['commercial', 'food'], 7, { stats: { revenue: 1 }, onBuild: [buys(1)], freeFirst: 'food' }),
  B('pawn-shop', 'Pawn Shop', 1, ['commercial'], 8, { stats: { jobs: 1, revenue: 1 }, onTurn: [perStatus('crime', 1, 3)], onBuild: [status('crime')], flavor: 'No questions asked.' }),
  B('hardware-store', 'Hardware Store', 1, ['commercial'], 7, { stats: { jobs: 1, revenue: 1 }, discount: { tag: 'infrastructure', amount: 1 }, onCombine: [gain(2)], flavor: 'Sells the nails for every renovation.' }),
  B('bakery', 'Bakery', 1, ['commercial', 'food'], 6, { stats: { jobs: 2, revenue: 1 }, near: [nd('revenue', 1, 'rural')], onCity: only('residential', gain(1)), flavor: 'A loaf for every new family.' }),
  B('laundromat', 'Laundromat', 1, ['commercial'], 6, { stats: { jobs: 1, revenue: 1 }, onBuild: [clear(1)], onAnyClear: [gain(1)] }),
  B('gas-station', 'Gas Station', 1, ['commercial'], 6, { stats: { jobs: 1, revenue: 2 }, near: [nd('revenue', 1, 'industrial')], onCity: only('industrial', grow('revenue', 1, 3)), onBuild: [status('pollution')] }),
  B('bookshop', 'Bookshop', 1, ['commercial', 'culture'], 7, { stats: { jobs: 1, revenue: 1 }, near: [nd('revenue', 1, 'education')], onNth: [draw(1)] }),
  B('shopping-arcade', 'Shopping Arcade', 2, ['commercial'], 9, { stats: { jobs: 3, revenue: 2 }, near: [nd('revenue', 1, 'commercial')], freeFirst: 'commercial', onBuild: [status('trash')], flavor: 'Shops that like company.' }),
  B('department-store', 'Department Store', 2, ['commercial'], 10, { stats: { jobs: 4, revenue: 2 }, buysBonus: 1, onCity: only('commercial', gain(1)), onBuild: [status('trash')], flavor: 'Everything under one roof.' }),
  B('bank-branch', 'Bank Branch', 2, ['commercial', 'finance'], 9, { stats: { jobs: 2, revenue: 2 }, near: [deck('revenue', 1, 'debt', 4)], flavor: 'Your debts are its interest.' }),
  B('restaurant-row', 'Restaurant Row', 2, ['commercial', 'food', 'leisure'], 11, { stats: { jobs: 3, revenue: 2 }, near: [nd('revenue', 1, 'culture'), nd('revenue', 1, 'residential')], onToken: only('tourist', gain(1)) }),
  B('hotel', 'Hotel', 2, ['commercial', 'tourism'], 12, { stats: { jobs: 3, revenue: 2 }, onTurn: [tokenPerAdj('tourist', 'landmark')], onToken: only('tourist', gain(1)), flavor: 'Every Tourist spends a little more.' }),
  B('farmers-market', 'Farmers Market', 2, ['commercial', 'food'], 10, { stats: { jobs: 2, revenue: 1 }, near: [nd('revenue', 1, 'rural'), nd('revenue', 1, 'green')], onCity: only('rural', grow('revenue', 1, 3)), onBuild: [clear(1)] }),
  B('nightclub', 'Nightclub', 2, ['commercial', 'leisure'], 10, { stats: { jobs: 2, revenue: 2 }, near: [nd('revenue', 1, 'leisure')], onNth: [gain(2)], onBuild: [status('crime')], flavor: 'Busiest on your busiest nights.' }),
  B('office-park', 'Office Park', 2, ['commercial', 'office'], 11, { stats: { jobs: 5, revenue: 2 }, near: [nd('revenue', 1, 'commercial')], onNth: [draw(1)] }),
  B('car-dealership', 'Car Dealership', 2, ['commercial'], 11, { stats: { jobs: 2, revenue: 3 }, near: [nd('revenue', 1, 'commercial')], onCombine: [gain(3)], onBuild: [status('pollution')], flavor: 'Trade-ins welcome.' }),
  B('pharmacy', 'Pharmacy', 2, ['commercial', 'health'], 10, { stats: { jobs: 2, revenue: 1 }, clears: 'pollution', slots: 1, onClear: [gain(2)] }),
  B('mall', 'Mall', 3, ['commercial'], 17, { stats: { jobs: 6, revenue: 4 }, buysBonus: 1, near: [nd('revenue', 1, 'residential')], onToken: [gain(1)], onBuild: [status('trash', 2)] }),
  B('stock-exchange', 'Stock Exchange', 3, ['commercial', 'finance', 'landmark'], 15, { stats: { jobs: 4, revenue: 2 }, near: [city('revenue', 1, 'commercial', { max: 6 })], onCombine: [grow('revenue', 2, 8)], unique: true, flavor: 'Loves a merger.' }),
  B('convention-center', 'Convention Center', 3, ['commercial', 'tourism'], 11, { stats: { jobs: 4, revenue: 2 }, onTurn: [tokenTurn('tourist')], onToken: only('tourist', grow('revenue', 1, 5)), onBuild: [status('trash')] }),
  B('corporate-hq', 'Corporate HQ', 3, ['commercial', 'office', 'landmark'], 20, { stats: { jobs: 8, revenue: 3 }, handSize: 1, onNth: [gain(3)], unique: true }),
  B('luxury-boutiques', 'Luxury Boutiques', 3, ['commercial', 'luxury'], 13, { stats: { jobs: 2, revenue: 3 }, near: [nd('revenue', 1, 'luxury'), nd('revenue', 1, 'landmark')], onToken: only('tourist', gain(2)) })
]

// ============================================================= INDUSTRIAL
export const INDUSTRIAL_CARDS = [
  B('workshop', 'Workshop', 1, ['industrial'], 6, { stats: { jobs: 2, revenue: 1 }, near: [nd('revenue', 1, 'industrial')], onCity: only('industrial', grow('revenue', 1, 3)) }),
  B('lumber-mill', 'Lumber Mill', 1, ['industrial'], 1, { stats: { jobs: 2 }, discount: { tag: 'residential', amount: 1 }, onBuild: [status('pollution')], flavor: 'Houses cost 1 less.' }),
  B('brickworks', 'Brickworks', 1, ['industrial'], 2, { stats: { jobs: 3 }, discount: { tag: 'commercial', amount: 1 }, onBuild: [status('pollution')], flavor: 'Shops cost 1 less.' }),
  B('warehouse', 'Warehouse', 1, ['industrial'], 9, { stats: { jobs: 2, revenue: 1 }, near: [nd('revenue', 1, 'industrial'), deck('revenue', 1, 'trash', 3)], flavor: 'Stores your junk, for a fee.' }),
  B('junkyard', 'Junkyard', 1, ['industrial', 'utility'], 5, { stats: { jobs: 1 }, clears: 'trash', slots: 2, onClear: [gain(1)], onBuild: [status('pollution')] }),
  B('quarry', 'Quarry', 1, ['industrial'], 2, { stats: { jobs: 3, revenue: 2 }, onBuild: [status('pollution', 2)] }),
  B('cannery', 'Cannery', 1, ['industrial', 'food'], 6, { stats: { jobs: 3, revenue: 1 }, near: [nd('revenue', 1, 'rural')], onCity: only('rural', gain(1)) }),
  B('textile-mill', 'Textile Mill', 1, ['industrial'], 2, { stats: { jobs: 4 }, near: [nd('revenue', 1, 'commercial')], onBuild: [status('pollution')] }),
  B('factory-complex', 'Factory Complex', 2, ['industrial'], 6, { stats: { jobs: 5, revenue: 1 }, near: [nd('revenue', 1, 'industrial')], onCity: only('industrial', grow('revenue', 1, 4)), onBuild: [status('pollution')] }),
  B('steel-mill', 'Steel Mill', 2, ['industrial'], 5, { stats: { jobs: 6, revenue: 1 }, near: [deck('revenue', 1, 'pollution', 4)], onBuild: [status('pollution', 2)], flavor: 'The dirtier the town, the busier the mill.' }),
  B('recycling-plant', 'Recycling Plant', 2, ['industrial', 'utility'], 9, { stats: { jobs: 3 }, clears: 'trash', slots: 2, onClear: [gain(2)], flavor: '+2 budget for every Trash card it takes.' }),
  B('coal-plant', 'Coal Power Plant', 2, ['industrial', 'utility'], 4, { stats: { jobs: 3 }, near: [city('revenue', 1, 'industrial', { max: 6 })], onBuild: [status('pollution', 2)], flavor: 'Powers every factory. Smokes like one too.' }),
  B('chemical-plant', 'Chemical Plant', 2, ['industrial'], 3, { stats: { jobs: 4, revenue: 1 }, near: [deck('revenue', 1, 'pollution', 5)], onBuild: [status('pollution', 3)], flavor: 'Paid by the barrel of sludge.' }),
  B('distribution-center', 'Distribution Center', 2, ['industrial'], 13, { stats: { jobs: 4, revenue: 1 }, buysBonus: 1, near: [nd('revenue', 1, 'industrial')], onCombine: [draw(2)] }),
  B('brewery', 'Brewery', 2, ['industrial', 'food', 'leisure'], 9, { stats: { jobs: 3, revenue: 2 }, near: [nd('revenue', 1, 'leisure')], onToken: only('tourist', gain(1)), flavor: 'Tours on the hour.' }),
  B('auto-plant', 'Auto Plant', 2, ['industrial'], 10, { stats: { jobs: 6, revenue: 2 }, onNth: [gain(2)], onBuild: [status('pollution')] }),
  B('tech-campus', 'Tech Campus', 3, ['commercial', 'office', 'education'], 15, { stats: { jobs: 6, revenue: 3 }, handSize: 1, near: [nd('revenue', 1, 'education')], onCity: only('education', grow('revenue', 1, 4)), flavor: 'Free snacks, draw a sixth card.' }),
  B('solar-farm', 'Solar Farm', 3, ['industrial', 'utility', 'green'], 11, { patience: 1, stats: { jobs: 2 }, near: [city('revenue', 1, 'industrial', { max: 6 })], flavor: 'Powers every factory, and the sky stays blue.' }),
  B('robotics-factory', 'Robotics Factory', 3, ['industrial'], 13, { stats: { jobs: 4, revenue: 4 }, onNth: [draw(1), gain(1)], onBuild: [status('pollution')] }),
  B('freight-hub', 'Freight Hub', 3, ['industrial'], 17, { stats: { jobs: 5, revenue: 2 }, buysBonus: 1, near: [nd('revenue', 1, 'industrial')], onCombine: [gain(3)] })
]

// ================================================================== GREEN
export const GREEN_CARDS = [
  B('pocket-park', 'Pocket Park', 1, ['green', 'park'], 6, { patience: 1, near: [nd('revenue', 1, 'residential')], onBuild: [growNb('residential', 'population', 1)], flavor: 'The homes around it fill up.' }),
  B('community-garden', 'Community Garden', 1, ['green', 'rural'], 10, { patience: 1, clears: 'pollution', slots: 1, near: [nd('population', 1, 'residential')], onClear: [grow('population', 1, 3)] }),
  B('playground', 'Playground', 1, ['green', 'park'], 7, { patience: 1, near: [nd('population', 1, 'residential'), nd('population', 1, 'education')], onNeighbor: only('residential', gain(1)), flavor: 'Families stay where kids play.' }),
  B('tree-lined-plaza', 'Tree-Lined Plaza', 1, ['green'], 6, { near: [nd('revenue', 1, 'commercial')], freeFirst: 'green' }),
  B('botanical-garden', 'Botanical Garden', 2, ['green', 'tourism', 'landmark'], 14, { patience: 2, stats: { revenue: 2 }, near: [nd('revenue', 1, 'green')], onCity: only('green', grow('revenue', 1, 4)) }),
  B('city-park', 'City Park', 2, ['green', 'park'], 13, { patience: 1, stats: { population: 1, revenue: 1 }, near: [nd('revenue', 1, 'residential'), nd('revenue', 1, 'commercial')], onTurn: [growNb('residential', 'population', 1, 3)], flavor: 'Every turn, the homes around it grow.' }),
  B('greenbelt', 'Greenbelt', 2, ['green'], 11, { patience: 1, clears: 'pollution', slots: 2, near: [nd('population', 1, 'residential')], onClear: [gain(1)] }),
  B('nature-reserve', 'Nature Reserve', 3, ['green', 'landmark'], 15, { patience: 2, stats: { revenue: 2 }, near: [city('population', 1, 'green', { max: 8 })], unique: true, flavor: '+1 population for every green space in the city.' })
]

// =============================================================== SERVICES
export const SERVICE_CARDS = [
  B('school', 'School', 1, ['education', 'service'], 6, { patience: 1, stats: { jobs: 2 }, near: [nd('population', 1, 'residential')], onNeighbor: only('residential', growNb('residential', 'population', 1)), flavor: 'Families move in next door.' }),
  B('library', 'Library', 1, ['education', 'culture', 'service'], 7, { patience: 1, stats: { jobs: 1 }, handSize: 1, flavor: 'Draw a sixth card every turn.' }),
  B('landfill', 'Landfill', 1, ['utility', 'service'], 3, { clears: 'trash', slots: 3, onBuild: [status('pollution')] }),
  B('water-tower', 'Water Tower', 1, ['utility', 'service'], 4, { onTurn: [perAdj('residential', 1)], flavor: 'Bills paid by the neighbours.' }),
  B('post-office', 'Post Office', 1, ['service'], 4, { stats: { jobs: 1 }, onTurn: [perCount('residential', 1, 3)], flavor: '+1 budget a turn for every three homes.' }),
  B('community-center', 'Community Center', 1, ['service', 'civic'], 10, { patience: 1, stats: { population: 1 }, clears: 'crime', slots: 1, onAnyClear: [grow('population', 1, 4)] }),
  B('precinct', 'Police Precinct', 2, ['safety', 'service'], 8, { stats: { jobs: 2 }, clears: 'crime', slots: 3, onClear: [gain(1)] }),
  B('hospital', 'Hospital', 2, ['health', 'service'], 8, { stats: { jobs: 4 }, clears: 'pollution', slots: 3, onClear: [grow('population', 1, 4)] }),
  B('fire-department', 'Fire Department', 2, ['safety', 'service'], 7, { stats: { jobs: 2 }, blocks: 2, flavor: 'Blocks two disaster cards every strike.' }),
  B('high-school', 'High School', 2, ['education', 'service'], 4, { stats: { jobs: 3 }, near: [nd('revenue', 1, 'residential')], onCity: only('education', grow('revenue', 1, 3)) }),
  B('courthouse', 'Courthouse', 2, ['safety', 'service'], 10, { stats: { jobs: 2 }, clears: ['crime', 'debt'], slots: 2, onClear: [gain(1)], flavor: 'Fines: +1 budget for every card it takes.' }),
  B('city-hall', 'City Hall', 2, ['service', 'landmark'], 15, { patience: 1, stats: { jobs: 3, revenue: 2 }, buysBonus: 1, onCombine: [pat(1)], unique: true, flavor: 'Every merger is a ribbon to cut.' }),
  B('university', 'University', 3, ['education', 'service', 'landmark'], 15, { stats: { jobs: 6, revenue: 2 }, handSize: 1, near: [nd('revenue', 1, 'education')], onNth: [draw(1)], unique: true }),
  B('prison', 'Prison', 3, ['safety', 'service'], 3, { patience: -1, stats: { jobs: 4 }, clears: 'crime', slots: 4 }),
  B('emergency-services', 'Emergency Services', 3, ['safety', 'health', 'service'], 17, { stats: { jobs: 3 }, blocks: 2, clears: ['crime', 'pollution'], slots: 2, onAnyClear: [gain(1)] })
]

// ================================================================== ROADS
// Traffic and transit are gone (Matt, 2026-10-31: "I never once thought about
// traffic... I never really understood what transit was doing anyway"):
// only the wider streets that two Roads combine into are left.
export const TRANSIT_CARDS = [
  B('boulevard', 'Boulevard', 2, ['infrastructure', 'transit-road'], 3, { placesRoad: true, roadSegments: 3, flavor: 'Three street segments, tree-lined.' }),
  B('highway', 'Highway', 3, ['infrastructure', 'transit-road'], 4, { placesRoad: true, roadSegments: 4, flavor: 'Four street segments at once.' }),
]

// ========================================================= LEISURE & CULTURE
export const LEISURE_CARDS = [
  B('movie-theater', 'Movie Theater', 1, ['leisure'], 11, { patience: 1, stats: { jobs: 2, revenue: 1 }, near: [nd('revenue', 1, 'commercial')], onNth: [gain(1)] }),
  B('bowling-alley', 'Bowling Alley', 1, ['leisure'], 9, { patience: 1, stats: { jobs: 1, revenue: 2 }, onNeighbor: [gain(1)] }),
  B('art-gallery', 'Art Gallery', 1, ['culture', 'arts'], 11, { patience: 1, stats: { revenue: 1 }, near: [nd('revenue', 1, 'culture'), nd('revenue', 1, 'arts')], onCity: only('culture', grow('revenue', 1, 3)) }),
  B('museum', 'Museum', 2, ['culture', 'landmark', 'tourism'], 12, { patience: 1, stats: { jobs: 2, revenue: 1 }, onTurn: [tokenTurn('tourist')] }),
  B('concert-hall', 'Concert Hall', 2, ['culture', 'leisure'], 12, { patience: 1, stats: { jobs: 2, revenue: 2 }, near: [nd('revenue', 1, 'culture')], onToken: only('tourist', gain(1)) }),
  B('casino', 'Casino', 2, ['leisure', 'tourism'], 2, { patience: -1, stats: { jobs: 3, revenue: 7 }, onBuild: [status('crime', 2)], onTurn: [status('crime')], flavor: 'The house always wins. So does crime.' }),
  B('zoo', 'Zoo', 2, ['leisure', 'green', 'tourism'], 12, { patience: 1, stats: { jobs: 2, revenue: 1 }, onTurn: [tokenTurn('tourist')] }),
  B('stadium', 'Stadium', 3, ['leisure', 'landmark', 'tourism'], 22, { patience: 2, stats: { jobs: 4, revenue: 3 }, onTurn: [tokenTurn('tourist', 2)], onBuild: [status('trash', 2)], unique: true }),
  B('cathedral', 'Cathedral', 3, ['culture', 'landmark'], 20, { patience: 3, stats: { population: 2 }, onTurn: [clear(1)], unique: true, flavor: 'Absolves one bad card a turn.' }),
  B('monument-plaza', 'Monument Plaza', 3, ['culture', 'landmark'], 11, { patience: 2, near: [city('population', 1, 'landmark', { max: 8 })], unique: true, flavor: '+1 population for every landmark in the city.' }),
  B('theme-park', 'Theme Park', 3, ['leisure', 'landmark', 'tourism'], 20, { patience: 2, stats: { jobs: 5, revenue: 2 }, onTurn: [tokenTurn('tourist', 2)], onBuild: [status('trash', 2)], unique: true }),
  B('observation-tower', 'Observation Tower', 3, ['landmark', 'tourism'], 18, { patience: 1, stats: { revenue: 2 }, near: [city('revenue', 1, 'landmark', { max: 6 })], onToken: only('tourist', grow('revenue', 1, 6)), onBuild: [token('tourist')] })
]

// ================================================================== CIVIC
export const CIVIC_CARDS = [
  C('grant', 'Grant', 1, 1, [gain(2)], { flavor: 'Free money, with forms.' }),
  C('bond-issue', 'Bond Issue', 1, 2, [gain(5), status('debt')], { flavor: 'Spend now, pay later. Adds a Debt card.' }),
  C('census', 'Census', 1, 1, [draw(2)]),
  C('cleanup-drive', 'Cleanup Drive', 1, 3, [clear(2)]),
  C('urban-planning', 'Urban Planning', 1, 1, [draw(1), buys(1)]),
  C('tax-audit', 'Tax Audit', 2, 2, [perCount('commercial', 1)], { flavor: '+1 budget for every shop in the city.' }),
  C('festival', 'Festival', 2, 4, [token('tourist', 2)], { flavor: 'Two Tourists come to town.' }),
  C('volunteer-day', 'Volunteer Day', 1, 4, [token('volunteer', 2)]),
  C('investor-summit', 'Investor Summit', 2, 3, [token('investor', 2)]),
  C('insurance-policy', 'Insurance Policy', 2, 3, [clear(1, { disasters: true }), draw(1)], { flavor: 'Takes a disaster card out of your deck.' }),
  C('property-tax', 'Property Tax', 2, 2, [perCount('residential', 1)], { flavor: '+1 budget for every home in the city.' }),
  C('job-fair', 'Job Fair', 1, 2, [perCount('industrial', 1)], { flavor: '+1 budget for every factory.' })
]

export const CITY_CARDS = [...RESIDENTIAL_CARDS, ...COMMERCIAL_CARDS, ...INDUSTRIAL_CARDS, ...GREEN_CARDS, ...SERVICE_CARDS, ...TRANSIT_CARDS, ...LEISURE_CARDS, ...CIVIC_CARDS]
// MULTI-TILE (Matt, 2026-10-29: "maybe a school takes two tiles... I like
// the idea of sort of having to Tetris them in"): the big places cover
// more than one plot (state/shapes.js). I2 = two in a row, I3 = three,
// L3 = an L of three, O4 = a 2×2 square. Turned when placing.
export const SHAPED = {
  I2: ['school', 'high-school', 'hospital', 'courthouse', 'mall', 'department-store', 'convention-center', 'office-park', 'factory-complex', 'steel-mill', 'auto-plant', 'distribution-center', 'museum', 'concert-hall', 'city-park', 'botanical-garden', 'townhouses', 'tech-campus', 'solar-farm', 'cathedral'],
  I3: ['greenbelt', 'restaurant-row', 'freight-hub'],
  L3: ['university', 'prison', 'zoo', 'cul-de-sac', 'garden-city-estate'],
  O4: ['stadium', 'theme-park', 'nature-reserve']
}
for (const [shape, ids] of Object.entries(SHAPED)) for (const id of ids) { const card = CITY_CARDS.find(c => c.id === id); if (card) card.shape = shape }

export const CITY_CATALOG = [...CITY_CARDS, ...TOKEN_CATALOG]

/** One copy of each, by tier. */
export const cityCardsOfTier = (tier) => CITY_CARDS.filter(c => (c.tier ?? 1) === tier && !c.placesRoad).map(c => c.id) // the city lays its own streets
