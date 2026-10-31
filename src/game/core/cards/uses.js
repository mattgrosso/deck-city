// USES (Matt, 2026-10-31: "each card... can be played a certain number of
// times, and it says on the card how many you have left. And then after that
// number of times, it's just gone... some cards that are one-time use, some
// cards that are five-time use, and that's another kind of lever").
//
// A card's uses come from `card.uses` when it names them, else from what it
// is (USES below). Each copy in the deck counts down on its own: a played
// card goes back as a fresh object carrying `usesLeft` (copies of a card
// share one catalog object, so nothing is written onto it). At zero it is
// gone from the deck. Status and disaster cards never count down; tokens
// and goals were already single use.

const STARTER_ZONES = new Set(['residential', 'commercial', 'industrial'])
const FACILITIES = new Set(['police-station', 'sanitation-center', 'clinic', 'fire-station', 'park'])

export const USES = {
  starterZone: 3, // Residential, Commercial, Industrial
  starterCivic: 3, // Civic Works
  facility: 2, // Police Station, Sanitation Center, Clinic, Fire Station, Park
  civic: 2,
  byTier: { 1: 3, 2: 2, 3: 1 },
  unique: 1
}

/** How many plays a fresh copy of this card has. Infinity = it never runs out. */
export function defaultUses (card) {
  if (!card) return Infinity
  if (card.uses != null) return card.uses
  if (card.type === 'status' || card.type === 'disaster' || card.type === 'goal') return Infinity
  if (card.exhaust || card.token) return 1
  if (card.placesRoad) return Infinity
  if (STARTER_ZONES.has(card.id)) return USES.starterZone
  if (card.id === 'civic-recycle') return USES.starterCivic
  if (FACILITIES.has(card.id)) return USES.facility
  if (card.type === 'civic') return USES.civic
  if (card.unique) return USES.unique
  return USES.byTier[card.tier ?? 1] ?? 1
}

/** Plays left on this copy. */
export const usesLeft = (card) => card?.usesLeft ?? defaultUses(card)

/** Does this card count down at all? */
export const isLimited = (card) => Number.isFinite(defaultUses(card)) && !card?.exhaust && !card?.token

/**
 * The copy that goes back into the deck after a play: the same card with one
 * use fewer, or null when that was its last.
 */
export function afterUse (card) {
  if (!isLimited(card)) return card
  const left = usesLeft(card) - 1
  return left > 0 ? { ...card, usesLeft: left } : null
}
