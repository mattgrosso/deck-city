// A pure dispatcher for goal conditions — structurally the same pattern as
// effects/effectRegistry.js (register a handler by type name, look it up
// generically), deliberately, so "add a new goal condition shape" reads the
// same way as "add a new effect type" rather than needing a second mental
// model. The only difference from effects is conditions evaluate to a
// boolean and never mutate state.

const registry = new Map()

/**
 * @param {string} type
 * @param {(condition: Object, context: Object) => boolean} evaluator
 */
export function registerCondition (type, evaluator) {
  registry.set(type, evaluator)
}

export function hasCondition (type) {
  return registry.has(type)
}

/**
 * @param {Object} condition - a condition descriptor, e.g. { type: 'populationAtLeast', amount: 10 }
 * @param {Object} context - { state, catalog }
 * @returns {boolean}
 */
export function evaluateCondition (condition, context) {
  const evaluator = registry.get(condition.type)
  if (!evaluator) {
    throw new Error(`Unknown condition type: "${condition.type}"`)
  }
  return evaluator(condition, context)
}
