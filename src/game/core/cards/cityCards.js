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
  if (Object.keys(effects).length) card.effects = effects
  if (o.clears) { card.clears = o.clears; card.slots = { capacity: o.slots ?? 2 } }
  for (const k of ['handSize', 'buysBonus', 'discount', 'blocks', 'unique', 'flavor', 'patience', 'placesRoad', 'roadSegments', 'lanes']) if (o[k] !== undefined) card[k === 'handSize' ? 'handSizeBonus' : k === 'blocks' ? 'blocksDisasters' : k] = o[k]
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

// ------------------------------------------------------------------ tokens
export const TOURIST = T('tourist', 'Tourist', [gain(2)], 'Spends money and leaves.')
export const COMMUTER = T('commuter', 'Commuter', [draw(2)], 'Brings the news from across town.')
export const VOLUNTEER = T('volunteer', 'Volunteer', [clear(1)], 'Picks up one mess, then goes home.')
export const INVESTOR = T('investor', 'Investor', [gain(1), buys(1)], 'Shows up with a chequebook.')
export const DEBT = { id: 'debt', type: CARD_TYPES.STATUS, name: 'Debt', tags: ['negative', 'debt'] }
export const TOKEN_CATALOG = [TOURIST, COMMUTER, VOLUNTEER, INVESTOR, DEBT]

// ============================================================ RESIDENTIAL
export const RESIDENTIAL_CARDS = [
  B('cottage', 'Cottage', 1, ['residential'], 5, { stats: { population: 1, revenue: 1 }, near: [nd('population', 1, 'green')], flavor: 'Roses by the door.' }),
  B('row-house', 'Row House', 1, ['residential'], 2, { stats: { population: 2 }, near: [nd('population', 1, 'residential')], onBuild: [status('crime')], flavor: 'Shares a wall, shares a street.' }),
  B('bungalow', 'Bungalow', 1, ['residential'], 4, { stats: { population: 2, revenue: 1 }, near: [nd('population', -1, 'commercial')], flavor: 'Quiet, please.' }),
  B('trailer-park', 'Trailer Park', 1, ['residential'], 2, { stats: { population: 4 }, onBuild: [status('crime'), status('trash')], flavor: 'Cheap, cheerful, a little loud.' }),
  B('duplex', 'Duplex', 1, ['residential'], 4, { stats: { population: 3, revenue: 1 }, onBuild: [status('crime')] }),
  B('garden-home', 'Garden Home', 1, ['residential'], 6, { stats: { population: 2 }, near: [nd('revenue', 1, 'green'), nd('population', 1, 'green')] }),
  B('farmhouse', 'Farmhouse', 1, ['residential', 'rural'], 6, { stats: { population: 1, jobs: 1, revenue: 1 }, near: [nd('revenue', 1, 'rural')], flavor: 'Up before the roosters.' }),
  B('boarding-house', 'Boarding House', 1, ['residential'], 6, { stats: { population: 2 }, onTurn: [perAdj('commercial', 1)], flavor: 'Rent is due Fridays.' }),
  B('company-housing', 'Company Housing', 1, ['residential'], 5, { stats: { population: 2 }, near: [nd('population', 2, 'industrial')], flavor: 'A short walk to the whistle.' }),
  B('student-dorm', 'Student Dorm', 1, ['residential', 'education'], 3, { stats: { population: 2 }, near: [nd('revenue', 1, 'education')], onBuild: [status('trash')] }),
  B('apartment-block', 'Apartment Block', 2, ['residential', 'dense'], 7, { stats: { population: 4, revenue: 1 }, near: [nd('population', 1, 'transit')], onBuild: [status('crime')] }),
  B('townhouses', 'Townhouses', 2, ['residential'], 9, { stats: { population: 3, revenue: 2 }, near: [nd('population', 1, 'residential')] }),
  B('senior-living', 'Senior Living', 2, ['residential'], 7, { stats: { population: 3, jobs: 1 }, near: [nd('population', 1, 'health'), nd('population', 1, 'green')], flavor: 'Bingo on Tuesdays.' }),
  B('co-op-housing', 'Co-op Housing', 2, ['residential'], 7, { stats: { population: 3 }, onBuild: [clear(1)], onNeighbor: [gain(1)], flavor: 'Everyone brings a dish.' }),
  B('loft-conversions', 'Loft Conversions', 2, ['residential', 'arts'], 9, { stats: { population: 3, revenue: 1 }, near: [nd('population', 1, 'industrial'), nd('revenue', 1, 'culture')], flavor: 'Exposed brick, exposed pipes.' }),
  B('gated-community', 'Gated Community', 2, ['residential'], 9, { stats: { population: 3, revenue: 3 }, near: [nd('revenue', -1, 'residential')], flavor: 'Members only.' }),
  B('mixed-use-tower', 'Mixed-Use Tower', 2, ['residential', 'commercial', 'dense'], 6, { stats: { population: 2, jobs: 2, revenue: 2 }, onBuild: [status('trash')], flavor: 'Counts as a house AND a shop.' }),
  B('housing-project', 'Housing Project', 2, ['residential', 'dense'], 1, { patience: -1, stats: { population: 6 }, onBuild: [status('crime', 2)] }),
  B('brownstones', 'Brownstones', 2, ['residential'], 10, { stats: { population: 3, revenue: 2 }, near: [nd('revenue', 1, 'culture')] }),
  B('cul-de-sac', 'Cul-de-sac', 2, ['residential'], 6, { stats: { population: 4 }, near: [nd('population', 1, 'green'), nd('population', -1, 'commercial')], flavor: 'Kids play in the street.' }),
  B('high-rise', 'High-Rise', 3, ['residential', 'dense'], 11, { stats: { population: 7, revenue: 2 }, near: [nd('population', 1, 'transit')], onBuild: [status('crime'), status('trash')] }),
  B('penthouse-tower', 'Penthouse Tower', 3, ['residential', 'luxury'], 20, { stats: { population: 4, revenue: 5 }, near: [nd('revenue', 1, 'green'), nd('revenue', 1, 'landmark')] }),
  B('arcology', 'Arcology', 3, ['residential', 'commercial', 'dense'], 13, { stats: { population: 8, jobs: 4, revenue: 2 }, unique: true, onBuild: [status('trash', 2)], flavor: 'A city in a building.' }),
  B('garden-city-estate', 'Garden City Estate', 3, ['residential'], 9, { stats: { population: 5 }, near: [nd('population', 2, 'green')] }),
  B('luxury-condos', 'Luxury Condos', 3, ['residential', 'luxury'], 17, { stats: { population: 5, revenue: 2 }, near: [city('revenue', 1, 'landmark')] })
]

// ============================================================= COMMERCIAL
export const COMMERCIAL_CARDS = [
  B('corner-store', 'Corner Store', 1, ['commercial'], 5, { stats: { jobs: 1, revenue: 1 }, near: [nd('revenue', 1, 'residential')] }),
  B('diner', 'Diner', 1, ['commercial', 'food'], 6, { stats: { jobs: 2, revenue: 1 }, onTurn: [perAdj('industrial', 1)], flavor: 'The shift change rush.' }),
  B('barber', 'Barber Shop', 1, ['commercial'], 3, { stats: { jobs: 1, revenue: 1 }, onBuild: [draw(1)], flavor: 'All the gossip, free with a trim.' }),
  B('market-stall', 'Market Stall', 1, ['commercial', 'food'], 3, { stats: { revenue: 1 }, onBuild: [buys(1)] }),
  B('pawn-shop', 'Pawn Shop', 1, ['commercial'], 8, { stats: { jobs: 1, revenue: 1 }, onTurn: [perStatus('crime', 1, 3)], onBuild: [status('crime')], flavor: 'No questions asked.' }),
  B('hardware-store', 'Hardware Store', 1, ['commercial'], 5, { stats: { jobs: 1, revenue: 1 }, discount: { tag: 'infrastructure', amount: 1 }, flavor: 'Roads are free.' }),
  B('bakery', 'Bakery', 1, ['commercial', 'food'], 7, { stats: { jobs: 2, revenue: 1 }, near: [nd('revenue', 1, 'residential'), nd('revenue', 1, 'rural')] }),
  B('laundromat', 'Laundromat', 1, ['commercial'], 4, { stats: { jobs: 1, revenue: 1 }, onBuild: [clear(1)] }),
  B('gas-station', 'Gas Station', 1, ['commercial'], 5, { stats: { jobs: 1, revenue: 2 }, near: [nd('revenue', 1, 'transit')], onBuild: [status('pollution')] }),
  B('bookshop', 'Bookshop', 1, ['commercial', 'culture'], 6, { stats: { jobs: 1, revenue: 1 }, near: [nd('revenue', 1, 'education')], onBuild: [draw(1)] }),
  B('shopping-arcade', 'Shopping Arcade', 2, ['commercial'], 6, { stats: { jobs: 3, revenue: 2 }, near: [nd('revenue', 1, 'commercial')], onBuild: [status('trash')], flavor: 'Shops that like company.' }),
  B('department-store', 'Department Store', 2, ['commercial'], 9, { stats: { jobs: 4, revenue: 2 }, buysBonus: 1, onBuild: [status('trash')], flavor: 'Everything under one roof. +1 buy every turn.' }),
  B('bank-branch', 'Bank Branch', 2, ['commercial', 'finance'], 11, { stats: { jobs: 2, revenue: 2 }, clears: 'debt', slots: 2, onBuild: [{ type: 'raiseTreasuryRolloverCap', amount: 4 }] }),
  B('restaurant-row', 'Restaurant Row', 2, ['commercial', 'food', 'leisure'], 10, { stats: { jobs: 3, revenue: 2 }, near: [nd('revenue', 1, 'culture'), nd('revenue', 1, 'residential')] }),
  B('hotel', 'Hotel', 2, ['commercial', 'tourism'], 9, { stats: { jobs: 3, revenue: 2 }, onTurn: [tokenPerAdj('tourist', 'landmark')], flavor: 'A Tourist each turn for every landmark next door.' }),
  B('farmers-market', 'Farmers Market', 2, ['commercial', 'food'], 9, { stats: { jobs: 2, revenue: 1 }, near: [nd('revenue', 1, 'rural'), nd('revenue', 1, 'green')], onBuild: [clear(1)] }),
  B('nightclub', 'Nightclub', 2, ['commercial', 'leisure'], 8, { stats: { jobs: 2, revenue: 3 }, near: [nd('revenue', 1, 'leisure')], onBuild: [status('crime')] }),
  B('office-park', 'Office Park', 2, ['commercial', 'office'], 8, { stats: { jobs: 5, revenue: 2 }, near: [nd('revenue', 1, 'transit')] }),
  B('car-dealership', 'Car Dealership', 2, ['commercial'], 8, { stats: { jobs: 2, revenue: 3 }, near: [nd('revenue', 1, 'transit')], onBuild: [status('pollution')] }),
  B('pharmacy', 'Pharmacy', 2, ['commercial', 'health'], 6, { stats: { jobs: 2, revenue: 1 }, clears: 'pollution', slots: 1 }),
  B('mall', 'Mall', 3, ['commercial'], 15, { stats: { jobs: 6, revenue: 4 }, buysBonus: 1, near: [nd('revenue', 1, 'transit')], onBuild: [status('trash', 2)] }),
  B('stock-exchange', 'Stock Exchange', 3, ['commercial', 'finance', 'landmark'], 12, { stats: { jobs: 4, revenue: 2 }, near: [city('revenue', 1, 'commercial', { max: 6 })], unique: true, flavor: '+1 revenue for every shop in the city.' }),
  B('convention-center', 'Convention Center', 3, ['commercial', 'tourism'], 8, { stats: { jobs: 4, revenue: 2 }, onTurn: [tokenTurn('tourist')], onBuild: [status('trash')] }),
  B('corporate-hq', 'Corporate HQ', 3, ['commercial', 'office', 'landmark'], 13, { stats: { jobs: 8, revenue: 3 }, handSize: 1, unique: true, flavor: 'Draw a sixth card every turn.' }),
  B('luxury-boutiques', 'Luxury Boutiques', 3, ['commercial', 'luxury'], 13, { stats: { jobs: 2, revenue: 4 }, near: [nd('revenue', 1, 'luxury'), nd('revenue', 1, 'landmark')] })
]

// ============================================================= INDUSTRIAL
export const INDUSTRIAL_CARDS = [
  B('workshop', 'Workshop', 1, ['industrial'], 5, { stats: { jobs: 2, revenue: 1 }, near: [nd('revenue', 1, 'industrial')] }),
  B('lumber-mill', 'Lumber Mill', 1, ['industrial'], 1, { stats: { jobs: 2 }, discount: { tag: 'residential', amount: 1 }, onBuild: [status('pollution')], flavor: 'Houses cost 1 less.' }),
  B('brickworks', 'Brickworks', 1, ['industrial'], 2, { stats: { jobs: 3 }, discount: { tag: 'commercial', amount: 1 }, onBuild: [status('pollution')], flavor: 'Shops cost 1 less.' }),
  B('warehouse', 'Warehouse', 1, ['industrial'], 6, { stats: { jobs: 2, revenue: 1 }, near: [nd('revenue', 1, 'transit')], onBuild: [{ type: 'raiseTreasuryRolloverCap', amount: 3 }] }),
  B('junkyard', 'Junkyard', 1, ['industrial', 'utility'], 3, { stats: { jobs: 1 }, clears: 'trash', slots: 2, onBuild: [status('pollution')] }),
  B('quarry', 'Quarry', 1, ['industrial'], 2, { stats: { jobs: 3, revenue: 2 }, onBuild: [status('pollution', 2)] }),
  B('cannery', 'Cannery', 1, ['industrial', 'food'], 6, { stats: { jobs: 3, revenue: 1 }, near: [nd('revenue', 1, 'rural')] }),
  B('textile-mill', 'Textile Mill', 1, ['industrial'], 2, { stats: { jobs: 4 }, near: [nd('revenue', 1, 'commercial')], onBuild: [status('pollution')] }),
  B('factory-complex', 'Factory Complex', 2, ['industrial'], 5, { stats: { jobs: 5, revenue: 1 }, near: [nd('revenue', 1, 'industrial')], onBuild: [status('pollution')] }),
  B('steel-mill', 'Steel Mill', 2, ['industrial'], 5, { stats: { jobs: 6, revenue: 3 }, onBuild: [status('pollution', 2)] }),
  B('recycling-plant', 'Recycling Plant', 2, ['industrial', 'utility'], 9, { stats: { jobs: 3 }, clears: 'trash', slots: 2, onClear: [gain(2)], flavor: '+2 budget for every Trash card it takes.' }),
  B('coal-plant', 'Coal Power Plant', 2, ['industrial', 'utility'], 4, { stats: { jobs: 3 }, near: [city('revenue', 1, 'industrial', { max: 6 })], onBuild: [status('pollution', 2)], flavor: 'Powers every factory. Smokes like one too.' }),
  B('chemical-plant', 'Chemical Plant', 2, ['industrial'], 5, { stats: { jobs: 4, revenue: 4 }, onBuild: [status('pollution', 3)], flavor: 'Three Pollution cards, and the best wages in town.' }),
  B('distribution-center', 'Distribution Center', 2, ['industrial', 'transit'], 11, { stats: { jobs: 4, revenue: 1 }, buysBonus: 1, near: [nd('revenue', 1, 'transit')] }),
  B('brewery', 'Brewery', 2, ['industrial', 'food', 'leisure'], 8, { stats: { jobs: 3, revenue: 2 }, near: [nd('revenue', 1, 'leisure')] }),
  B('auto-plant', 'Auto Plant', 2, ['industrial'], 7, { stats: { jobs: 6, revenue: 2 }, onBuild: [status('pollution')], near: [nd('revenue', 1, 'industrial')] }),
  B('tech-campus', 'Tech Campus', 3, ['commercial', 'office', 'education'], 14, { stats: { jobs: 6, revenue: 3 }, handSize: 1, near: [nd('revenue', 1, 'education')], flavor: 'Free snacks, draw a sixth card.' }),
  B('solar-farm', 'Solar Farm', 3, ['industrial', 'utility', 'green'], 7, { stats: { jobs: 2 }, near: [city('revenue', 1, 'industrial', { max: 6 })], flavor: 'Powers every factory, and the sky stays blue.' }),
  B('robotics-factory', 'Robotics Factory', 3, ['industrial'], 10, { stats: { jobs: 4, revenue: 5 }, onBuild: [status('pollution')] }),
  B('freight-hub', 'Freight Hub', 3, ['industrial', 'transit'], 14, { stats: { jobs: 5, revenue: 2 }, buysBonus: 1, near: [nd('revenue', 1, 'industrial')] })
]

// ================================================================== GREEN
export const GREEN_CARDS = [
  B('pocket-park', 'Pocket Park', 1, ['green', 'park'], 7, { patience: 1, near: [nd('revenue', 1, 'residential')], onBuild: [clear(1)] }),
  B('community-garden', 'Community Garden', 1, ['green', 'rural'], 8, { patience: 1, clears: 'pollution', slots: 1, near: [nd('population', 1, 'residential')] }),
  B('playground', 'Playground', 1, ['green', 'park'], 6, { patience: 1, near: [nd('population', 1, 'residential'), nd('population', 1, 'education')], flavor: 'Families stay where kids play.' }),
  B('tree-lined-plaza', 'Tree-Lined Plaza', 1, ['green'], 2, { near: [nd('revenue', 1, 'commercial')] }),
  B('botanical-garden', 'Botanical Garden', 2, ['green', 'tourism', 'landmark'], 13, { patience: 2, stats: { revenue: 2 }, near: [nd('revenue', 1, 'green')] }),
  B('city-park', 'City Park', 2, ['green', 'park'], 15, { patience: 1, stats: { population: 1, revenue: 1 }, near: [nd('revenue', 1, 'residential'), nd('revenue', 1, 'commercial')], clears: 'pollution', slots: 1 }),
  B('greenbelt', 'Greenbelt', 2, ['green'], 9, { patience: 1, clears: 'pollution', slots: 2, near: [nd('population', 1, 'residential')] }),
  B('nature-reserve', 'Nature Reserve', 3, ['green', 'landmark'], 15, { patience: 2, stats: { revenue: 2 }, near: [city('population', 1, 'green', { max: 8 })], unique: true, flavor: '+1 population for every green space in the city.' })
]

// =============================================================== SERVICES
export const SERVICE_CARDS = [
  B('school', 'School', 1, ['education', 'service'], 6, { patience: 1, stats: { jobs: 2 }, near: [nd('population', 1, 'residential')], flavor: 'Families move in next door.' }),
  B('library', 'Library', 1, ['education', 'culture', 'service'], 7, { patience: 1, stats: { jobs: 1 }, handSize: 1, flavor: 'Draw a sixth card every turn.' }),
  B('landfill', 'Landfill', 1, ['utility', 'service'], 3, { clears: 'trash', slots: 3, onBuild: [status('pollution')] }),
  B('water-tower', 'Water Tower', 1, ['utility', 'service'], 4, { onTurn: [perAdj('residential', 1)], flavor: 'Bills paid by the neighbours.' }),
  B('post-office', 'Post Office', 1, ['service'], 4, { stats: { jobs: 1 }, onTurn: [perCount('residential', 1, 3)], flavor: '+1 budget a turn for every three homes.' }),
  B('community-center', 'Community Center', 1, ['service', 'civic'], 10, { patience: 1, stats: { population: 1 }, clears: 'crime', slots: 1, near: [nd('population', 1, 'residential')] }),
  B('precinct', 'Police Precinct', 2, ['safety', 'service'], 6, { stats: { jobs: 2 }, clears: 'crime', slots: 3 }),
  B('hospital', 'Hospital', 2, ['health', 'service'], 8, { stats: { jobs: 4 }, clears: 'pollution', slots: 3, near: [nd('population', 1, 'residential')] }),
  B('fire-department', 'Fire Department', 2, ['safety', 'service'], 7, { stats: { jobs: 2 }, blocks: 2, flavor: 'Blocks two disaster cards every strike.' }),
  B('high-school', 'High School', 2, ['education', 'service'], 3, { stats: { jobs: 3 }, near: [nd('revenue', 1, 'residential')] }),
  B('courthouse', 'Courthouse', 2, ['safety', 'service'], 10, { stats: { jobs: 2 }, clears: ['crime', 'debt'], slots: 2, onClear: [gain(1)], flavor: 'Fines: +1 budget for every card it takes.' }),
  B('city-hall', 'City Hall', 2, ['service', 'landmark'], 18, { patience: 2, stats: { jobs: 3, revenue: 2 }, buysBonus: 1, unique: true, flavor: '+1 buy every turn.' }),
  B('university', 'University', 3, ['education', 'service', 'landmark'], 12, { stats: { jobs: 6, revenue: 2 }, handSize: 1, near: [nd('revenue', 1, 'education')], unique: true }),
  B('prison', 'Prison', 3, ['safety', 'service'], 4, { patience: -1, stats: { jobs: 4 }, clears: 'crime', slots: 4 }),
  B('emergency-services', 'Emergency Services', 3, ['safety', 'health', 'service'], 15, { stats: { jobs: 3 }, blocks: 2, clears: ['crime', 'pollution'], slots: 2 })
]

// ================================================================ TRANSIT
export const TRANSIT_CARDS = [
  B('boulevard', 'Boulevard', 2, ['infrastructure', 'transit-road'], 3, { placesRoad: true, roadSegments: 3, lanes: 2, flavor: 'Three street segments, tree-lined, two lanes each way.' }),
  B('highway', 'Highway', 3, ['infrastructure', 'transit-road'], 4, { placesRoad: true, roadSegments: 4, lanes: 3, flavor: 'Four street segments at once, three lanes wide.' }),
  B('bus-stop', 'Bus Stop', 1, ['transit'], 4, { onTurn: [perAdj('commercial', 1)], onBuild: [draw(1)] }),
  B('parking-garage', 'Parking Garage', 1, ['transit'], 4, { stats: { revenue: 1 }, near: [nd('revenue', 1, 'commercial')] }),
  B('bike-share', 'Bike Share', 1, ['transit', 'green'], 4, { onTurn: [perAdj('residential', 1)] }),
  B('train-station', 'Train Station', 2, ['transit', 'landmark'], 6, { stats: { jobs: 2, revenue: 1 }, onTurn: [tokenTurn('commuter')], flavor: 'A Commuter card every turn: play it to draw two.' }),
  B('tram-depot', 'Tram Depot', 2, ['transit'], 6, { stats: { jobs: 3 }, near: [nd('revenue', 1, 'commercial')], discount: { tag: 'infrastructure', amount: 1 } }),
  B('ferry-terminal', 'Ferry Terminal', 2, ['transit', 'tourism'], 9, { stats: { jobs: 2, revenue: 2 }, onBuild: [token('tourist', 2)] }),
  B('airport', 'Airport', 3, ['transit', 'landmark'], 12, { stats: { jobs: 6, revenue: 3 }, onTurn: [tokenTurn('tourist', 2)], onBuild: [status('pollution', 2)], unique: true }),
  B('metro-hub', 'Metro Hub', 3, ['transit'], 9, { stats: { jobs: 3, revenue: 2 }, near: [city('population', 1, 'transit', { max: 6 })] })
]

// ========================================================= LEISURE & CULTURE
export const LEISURE_CARDS = [
  B('movie-theater', 'Movie Theater', 1, ['leisure'], 9, { patience: 1, stats: { jobs: 2, revenue: 1 }, near: [nd('revenue', 1, 'commercial')] }),
  B('bowling-alley', 'Bowling Alley', 1, ['leisure'], 9, { patience: 1, stats: { jobs: 1, revenue: 2 }, onNeighbor: [gain(1)] }),
  B('art-gallery', 'Art Gallery', 1, ['culture', 'arts'], 10, { patience: 1, stats: { revenue: 1 }, near: [nd('revenue', 1, 'culture'), nd('revenue', 1, 'arts')] }),
  B('museum', 'Museum', 2, ['culture', 'landmark', 'tourism'], 10, { patience: 1, stats: { jobs: 2, revenue: 1 }, onTurn: [tokenTurn('tourist')] }),
  B('concert-hall', 'Concert Hall', 2, ['culture', 'leisure'], 11, { patience: 1, stats: { jobs: 2, revenue: 2 }, near: [nd('revenue', 1, 'culture')] }),
  B('casino', 'Casino', 2, ['leisure', 'tourism'], 2, { patience: -1, stats: { jobs: 3, revenue: 7 }, onBuild: [status('crime', 2)], onTurn: [status('crime')], flavor: 'The house always wins. So does crime.' }),
  B('zoo', 'Zoo', 2, ['leisure', 'green', 'tourism'], 10, { patience: 1, stats: { jobs: 2, revenue: 1 }, onTurn: [tokenTurn('tourist')] }),
  B('stadium', 'Stadium', 3, ['leisure', 'landmark', 'tourism'], 18, { patience: 2, stats: { jobs: 4, revenue: 3 }, onTurn: [tokenTurn('tourist', 2)], onBuild: [status('trash', 2)], unique: true }),
  B('cathedral', 'Cathedral', 3, ['culture', 'landmark'], 20, { patience: 3, stats: { population: 2 }, onTurn: [clear(1)], unique: true, flavor: 'Absolves one bad card a turn.' }),
  B('monument-plaza', 'Monument Plaza', 3, ['culture', 'landmark'], 11, { patience: 2, near: [city('population', 1, 'landmark', { max: 8 })], unique: true, flavor: '+1 population for every landmark in the city.' }),
  B('theme-park', 'Theme Park', 3, ['leisure', 'landmark', 'tourism'], 17, { patience: 2, stats: { jobs: 5, revenue: 2 }, onTurn: [tokenTurn('tourist', 2)], onBuild: [status('trash', 2)], unique: true }),
  B('observation-tower', 'Observation Tower', 3, ['landmark', 'tourism'], 16, { patience: 1, stats: { revenue: 2 }, near: [city('revenue', 1, 'landmark', { max: 6 })], onBuild: [token('tourist')] })
]

// ================================================================== CIVIC
export const CIVIC_CARDS = [
  C('grant', 'Grant', 1, 1, [gain(2)], { flavor: 'Free money, with forms.' }),
  C('bond-issue', 'Bond Issue', 1, 2, [gain(5), status('debt')], { flavor: 'Spend now, pay later. Adds a Debt card.' }),
  C('census', 'Census', 1, 1, [draw(2)]),
  C('cleanup-drive', 'Cleanup Drive', 1, 3, [clear(2)]),
  C('urban-planning', 'Urban Planning', 1, 1, [draw(1), buys(1)]),
  C('tax-audit', 'Tax Audit', 2, 2, [perCount('commercial', 1)], { flavor: '+1 budget for every shop in the city.' }),
  C('festival', 'Festival', 2, 3, [token('tourist', 2)], { flavor: 'Two Tourists come to town.' }),
  C('volunteer-day', 'Volunteer Day', 1, 3, [token('volunteer', 2)]),
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
  I2: ['school', 'high-school', 'hospital', 'courthouse', 'mall', 'department-store', 'convention-center', 'office-park', 'factory-complex', 'steel-mill', 'auto-plant', 'distribution-center', 'train-station', 'museum', 'concert-hall', 'city-park', 'botanical-garden', 'townhouses', 'tech-campus', 'solar-farm', 'cathedral'],
  I3: ['greenbelt', 'restaurant-row', 'freight-hub'],
  L3: ['university', 'prison', 'zoo', 'cul-de-sac', 'garden-city-estate'],
  O4: ['stadium', 'airport', 'theme-park', 'nature-reserve']
}
for (const [shape, ids] of Object.entries(SHAPED)) for (const id of ids) { const card = CITY_CARDS.find(c => c.id === id); if (card) card.shape = shape }

export const CITY_CATALOG = [...CITY_CARDS, ...TOKEN_CATALOG]

/** One copy of each, by tier. */
export const cityCardsOfTier = (tier) => CITY_CARDS.filter(c => (c.tier ?? 1) === tier).map(c => c.id)
