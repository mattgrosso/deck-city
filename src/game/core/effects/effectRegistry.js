// A pure dispatcher for card effects. It holds no game-state mutation logic
// itself — handlers registered here delegate to state/deck/row mutators.
// This is what keeps "add a new effect type" an isolated addition instead
// of a change to the turn manager or any other consumer.

const registry = new Map()

/**
 * @param {string} type
 * @param {(effect: Object, context: Object) => *} handler
 */
export function registerEffect (type, handler) {
  registry.set(type, handler)
}

export function hasEffect (type) {
  return registry.has(type)
}

/**
 * @param {Object} effect - an effect descriptor, e.g. { type: 'gainTreasury', amount: 3 }
 * @param {Object} context - { state, source, rng, log, ... }
 */
export function resolveEffect (effect, context) {
  const handler = registry.get(effect.type)
  if (!handler) {
    throw new Error(`Unknown effect type: "${effect.type}"`)
  }
  return handler(effect, context)
}

/**
 * @param {Object[]} effects
 * @param {Object} context
 */
export function resolveEffects (effects = [], context) {
  return effects.map(effect => resolveEffect(effect, context))
}

/**
 * Resolves all effects for a given trigger on a card (e.g. 'onBuild'). Does
 * nothing if the card has no effects for that trigger.
 * @param {Object} card
 * @param {string} triggerName
 * @param {Object} context
 */
export function resolveTrigger (card, triggerName, context) {
  const list = card.effects && card.effects[triggerName]
  if (!list) return []
  return resolveEffects(list, { ...context, card })
}
