// COMBINING (Matt, 2026-10-29: "categories of cards that can combine into
// better cards... keep the deck thinner while having the deck evolve";
// "make combined cost budget... pick from two things... they should feel
// like a combination of the two things... like mixed use, but we have
// names for them... could we build sort of combo buildings?").
//
// Any two buildings in hand may combine during the build phase, for budget.
// Both leave the deck for good; one new card - chosen from two - goes to the
// discard pile. The new card IS the two: both cards' stats, both cards'
// abilities, both cards' tags (a Mixed-Use Block counts as homes and as
// shops), plus a little more in the direction of whichever half it leans
// to. Its name comes from the pair of families (NAMES below), so every
// pairing - even a factory and a park - is a real place.
//
// A combined card does not combine again (yet).

import { CARD_TYPES } from './cardSchema'

// The family a building belongs to for naming. Mirrors ui/cardText.js's
// familyOf for buildings; kept here so the engine stays free of UI code.
export function buildingFamily (card) {
  if (card.family) return card.family
  const tags = card.tags ?? []
  if (tags.includes('landmark') && !tags.includes('residential') && !tags.includes('commercial')) return 'landmark'
  for (const tag of ['residential', 'commercial', 'industrial', 'transit']) if (tags.includes(tag)) return tag
  if (tags.includes('green') || tags.includes('park')) return 'green'
  if (tags.includes('leisure') || tags.includes('culture') || tags.includes('tourism')) return 'leisure'
  return 'facility'
}

// What each family leans toward: the first is its main stat, the second
// what a same-family pair offers as the other choice. 'patience' is +1
// Public Patience a turn.
const LEAN = {
  residential: ['population', 'revenue'],
  commercial: ['revenue', 'jobs'],
  industrial: ['jobs', 'revenue'],
  transit: ['revenue', 'population'],
  green: ['patience', 'population'],
  leisure: ['patience', 'revenue'],
  facility: ['jobs', 'patience'],
  landmark: ['revenue', 'patience']
}

// Families in alphabetical order make the key; the two names lean to the
// first family and to the second (for a same-family pair: to its main stat
// and to its other one).
export const NAMES = {
  'commercial+commercial': ['Shopping Arcade', 'Department Store'],
  'commercial+facility': ['Service Plaza', 'Civic Center'],
  'commercial+green': ['Garden Center', 'Market Green'],
  'commercial+industrial': ['Outlet Mall', 'Maker Space'],
  'commercial+landmark': ['Grand Bazaar', 'Landmark Tower'],
  'commercial+leisure': ['Food Hall', 'Cinema Complex'],
  'commercial+residential': ['Main Street Shops', 'Mixed-Use Block'],
  'commercial+transit': ['Station Mall', 'Transit Hub'],
  'facility+facility': ['Public Safety Complex', 'Municipal Campus'],
  'facility+green': ['Ranger Station', 'Botanic Garden'],
  'facility+industrial': ['Public Works Yard', 'Water Works'],
  'facility+landmark': ['City Hall', 'Capitol Dome'],
  'facility+leisure': ['Community Center', 'Public Library'],
  'facility+residential': ['Neighborhood Center', 'Care Home'],
  'facility+transit': ['Transit Authority', 'Bus Depot'],
  'green+green': ['Nature Reserve', 'Grand Park'],
  'green+industrial': ['Tree Nursery', 'Lumber Mill'],
  'green+landmark': ['Arboretum', 'Memorial Gardens'],
  'green+leisure': ['Picnic Grounds', 'Open-Air Theater'],
  'green+residential': ['Garden Village', 'Park Terraces'],
  'green+transit': ['Greenway', 'Park & Ride'],
  'industrial+industrial': ['Industrial Park', 'Factory Complex'],
  'industrial+landmark': ['Clock Tower Works', 'Mill Museum'],
  'industrial+leisure': ['Brewery', 'Arts Warehouse'],
  'industrial+residential': ['Company Town', 'Loft Conversion'],
  'industrial+transit': ['Rail Works', 'Freight Yard'],
  'landmark+landmark': ['Grand Plaza', 'Skyline'],
  'landmark+leisure': ['Grand Museum', 'Opera House'],
  'landmark+residential': ['Historic Mansion', 'Heritage Terrace'],
  'landmark+transit': ['Grand Central', 'Union Station'],
  'leisure+leisure': ['Arts District', 'Entertainment Quarter'],
  'leisure+residential': ['Resort Village', 'Artist Lofts'],
  'leisure+transit': ['Boardwalk', 'Cable Car'],
  'residential+residential': ['Apartment Block', 'Townhouse Row'],
  'residential+transit': ['Commuter Village', 'Transit Village'],
  'transit+transit': ['Interchange', 'Grand Terminal']
}

/** May this card be combined? Buildings only; not Roads, goals, one-of-a-kinds, or a card already combined. */
export function canCombine (card) {
  return !!card && card.type === CARD_TYPES.BUILDING && !card.placesRoad && !card.unique && !card.combo
}

/** What combining two cards costs: half what building both would. */
export function combineCost (a, b) {
  return Math.ceil(((a.cost ?? 0) + (b.cost ?? 0)) / 2)
}

const sumNumbers = (x, y) => (x ?? 0) + (y ?? 0)
const asList = (v) => (Array.isArray(v) ? v : v ? [v] : [])

/** Both cards in one: stats summed, abilities kept, tags joined. */
function merge (a, b) {
  const stats = {}
  for (const k of new Set([...Object.keys(a.stats ?? {}), ...Object.keys(b.stats ?? {})])) stats[k] = sumNumbers(a.stats?.[k], b.stats?.[k])
  const card = {
    type: CARD_TYPES.BUILDING,
    tier: Math.max(a.tier ?? 1, b.tier ?? 1),
    tags: [...new Set([...(a.tags ?? []), ...(b.tags ?? [])])],
    cost: (a.cost ?? 0) + (b.cost ?? 0),
    stats,
    combo: true,
    madeFrom: [a.name, b.name],
    // How it looks on the board and on the card: like the dearer half.
    lookAs: (b.cost ?? 0) > (a.cost ?? 0) ? b : a
  }
  const rules = [...(a.adjacency?.statBonus ?? []), ...(b.adjacency?.statBonus ?? [])]
  if (rules.length) card.adjacency = { statBonus: rules }
  const effects = {}
  for (const src of [a.effects ?? {}, b.effects ?? {}]) for (const [k, v] of Object.entries(src)) effects[k] = [...(effects[k] ?? []), ...asList(v)]
  if (Object.keys(effects).length) card.effects = effects
  const clears = [...new Set([...asList(a.clears), ...asList(b.clears)])]
  if (clears.length) { card.clears = clears; card.slots = { capacity: sumNumbers(a.slots?.capacity, b.slots?.capacity) || 1 } }
  for (const k of ['handSizeBonus', 'buysBonus', 'blocksDisasters', 'patience']) {
    const n = sumNumbers(typeof a[k] === 'number' ? a[k] : a[k] ? 1 : 0, typeof b[k] === 'number' ? b[k] : b[k] ? 1 : 0)
    if (n) card[k] = n
  }
  const discount = [...asList(a.discount), ...asList(b.discount)]
  if (discount.length) card.discount = discount
  return card
}

const lean = (card, stat) => {
  if (stat === 'patience') card.patience = (card.patience ?? 0) + 1
  else card.stats = { ...card.stats, [stat]: (card.stats[stat] ?? 0) + 1 }
  card.lean = stat
  return card
}

/** The two cards combining `a` and `b` would offer. Deterministic: same pair, same two cards. */
export function combineOptions (a, b) {
  const [first, second] = [a, b].sort((x, y) => (buildingFamily(x) < buildingFamily(y) ? -1 : buildingFamily(x) > buildingFamily(y) ? 1 : 0))
  const fa = buildingFamily(first)
  const fb = buildingFamily(second)
  const names = NAMES[`${fa}+${fb}`] ?? [`${first.name} & ${second.name}`, `${second.name} & ${first.name}`]
  const leans = fa === fb ? [[fa, LEAN[fa][0]], [fa, LEAN[fa][1]]] : [[fa, LEAN[fa][0]], [fb, LEAN[fb][0]]]
  const ids = [a.id, b.id].sort().join('+')
  return leans.map(([family, stat], k) => lean({ ...merge(first, second), id: `combo:${ids}:${k}`, name: names[k], family }, stat))
}
