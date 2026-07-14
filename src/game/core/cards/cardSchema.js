// Card data schema shared by every card family in the game. Cards are plain
// data objects, not classes — adding a new card should mean adding an entry
// to a card list, not writing new engine code. Family-specific concerns
// (goal tiers, consumer slots) are additive optional fields on the same
// envelope rather than separate types, so validateCard() stays a single
// generic function.

export const CARD_TYPES = Object.freeze({
  BUILDING: 'building', // includes plain buildings and city-row unlocks (Clinic, School, ...)
  STATUS: 'status',
  GOAL: 'goal',
  DISASTER: 'disaster'
})

/**
 * @typedef {Object} SlotsConfig
 * @property {number} capacity
 * @property {boolean} [expandable]
 * @property {number} [maxMultiplier]
 */

/**
 * @typedef {Object} EffectDescriptor
 * @property {string} type - looked up in the effect registry
 * @property {*} [rest] - handler-specific fields (amount, card, buildingId, ...)
 */

/**
 * @typedef {Object} Card
 * @property {string} id
 * @property {string} type - one of CARD_TYPES
 * @property {string} name
 * @property {number} [cost]
 * @property {string[]} [tags]
 * @property {Object<string, number>} [stats] - generic numeric contributions, e.g. { population: 2, revenue: 1 }
 * @property {SlotsConfig} [slots] - consumer buildings only
 * @property {number} [tier] - goals only
 * @property {Object} [condition] - goals only, a descriptor checked by the caller
 * @property {Object<string, EffectDescriptor[]>} [effects] - triggerName -> effect descriptors
 */

/**
 * Validates a card's shape. Returns an array of human-readable error
 * strings; an empty array means the card is valid.
 * @param {Card} card
 * @returns {string[]}
 */
export function validateCard (card) {
  const errors = []

  if (!card || typeof card !== 'object') {
    return ['card must be an object']
  }

  if (!card.id) errors.push('missing id')
  if (!card.name) errors.push('missing name')
  if (!Object.values(CARD_TYPES).includes(card.type)) {
    errors.push(`unknown type "${card.type}"`)
  }

  if (card.effects) {
    for (const [trigger, list] of Object.entries(card.effects)) {
      if (!Array.isArray(list)) {
        errors.push(`effects.${trigger} must be an array of effect descriptors`)
        continue
      }
      list.forEach((effect, index) => {
        if (!effect || typeof effect.type !== 'string') {
          errors.push(`effects.${trigger}[${index}] is missing a type`)
        }
      })
    }
  }

  if (card.slots && typeof card.slots.capacity !== 'number') {
    errors.push('slots.capacity must be a number')
  }

  return errors
}

/**
 * Builds an id -> card lookup used to resolve effect descriptors that
 * reference other cards by id (e.g. { type: 'gainStatus', card: 'crime' }).
 * @param {Card[]} cards
 * @returns {Object<string, Card>}
 */
export function buildCardCatalog (cards) {
  return Object.fromEntries(cards.map(card => [card.id, card]))
}
