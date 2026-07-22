import { describe, it, expect } from 'vitest'
import { registerCondition, hasCondition, evaluateCondition } from './conditionRegistry'

describe('registerCondition / evaluateCondition', () => {
  it('dispatches to a registered evaluator', () => {
    registerCondition('test.always-true', () => true)
    expect(evaluateCondition({ type: 'test.always-true' }, {})).toBe(true)
  })

  it('passes the condition descriptor and context through', () => {
    registerCondition('test.threshold', (condition, context) => context.value >= condition.amount)
    expect(evaluateCondition({ type: 'test.threshold', amount: 5 }, { value: 5 })).toBe(true)
    expect(evaluateCondition({ type: 'test.threshold', amount: 5 }, { value: 4 })).toBe(false)
  })

  it('throws for an unknown condition type', () => {
    expect(() => evaluateCondition({ type: 'no-such-condition' }, {})).toThrow(/Unknown condition type/)
  })
})

describe('hasCondition', () => {
  it('reports whether a type is registered', () => {
    registerCondition('test.registered', () => true)
    expect(hasCondition('test.registered')).toBe(true)
    expect(hasCondition('test.not-registered')).toBe(false)
  })
})
