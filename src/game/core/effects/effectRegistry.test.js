import { describe, it, expect } from 'vitest'
import { registerEffect, hasEffect, resolveEffect, resolveEffects, resolveTrigger } from './effectRegistry'

describe('registerEffect / resolveEffect', () => {
  it('dispatches to the registered handler with the effect and context', () => {
    registerEffect('test.echo', (effect, context) => ({ effect, context }))
    const context = { state: {} }
    const result = resolveEffect({ type: 'test.echo', amount: 3 }, context)
    expect(result.effect).toEqual({ type: 'test.echo', amount: 3 })
    expect(result.context).toBe(context)
  })

  it('throws on an unknown effect type', () => {
    expect(() => resolveEffect({ type: 'test.does-not-exist' }, {})).toThrow(
      /Unknown effect type/
    )
  })

  it('hasEffect reports whether a type is registered', () => {
    registerEffect('test.known', () => {})
    expect(hasEffect('test.known')).toBe(true)
    expect(hasEffect('test.unregistered')).toBe(false)
  })
})

describe('resolveEffects', () => {
  it('resolves a list of effects in order', () => {
    const calls = []
    registerEffect('test.record', (effect) => calls.push(effect.value))
    resolveEffects([{ type: 'test.record', value: 1 }, { type: 'test.record', value: 2 }], {})
    expect(calls).toEqual([1, 2])
  })

  it('returns an empty array for an empty/undefined effect list', () => {
    expect(resolveEffects([], {})).toEqual([])
    expect(resolveEffects(undefined, {})).toEqual([])
  })
})

describe('resolveTrigger', () => {
  it('resolves a card trigger and merges the card into context', () => {
    registerEffect('test.withCard', (effect, context) => context.card)
    const card = { id: 'x', effects: { onBuild: [{ type: 'test.withCard' }] } }
    const [result] = resolveTrigger(card, 'onBuild', {})
    expect(result).toBe(card)
  })

  it('does nothing if the card has no effects for that trigger', () => {
    const card = { id: 'x', effects: {} }
    expect(resolveTrigger(card, 'onBuild', {})).toEqual([])
  })

  it('does nothing if the card has no effects at all', () => {
    const card = { id: 'x' }
    expect(resolveTrigger(card, 'onBuild', {})).toEqual([])
  })
})
