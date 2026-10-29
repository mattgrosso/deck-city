import { describe, it, expect } from 'vitest'
import { actionsFromGamepad, actionFromKey, createRepeater, REPEAT_DELAY_MS, REPEAT_RATE_MS } from './input'

const pad = (pressed = [], axes = [0, 0]) => ({
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })),
  axes
})

describe('actionsFromGamepad', () => {
  it('maps the standard layout: A select, B back, Y confirm, X deck, bumpers piles, d-pad directions', () => {
    expect([...actionsFromGamepad(pad([0]))]).toEqual(['select'])
    expect([...actionsFromGamepad(pad([1]))]).toEqual(['back'])
    expect([...actionsFromGamepad(pad([3]))]).toEqual(['confirm'])
    expect([...actionsFromGamepad(pad([2]))]).toEqual(['deck'])
    expect([...actionsFromGamepad(pad([4, 5]))]).toEqual(['prevPile', 'nextPile'])
    expect([...actionsFromGamepad(pad([12, 15]))]).toEqual(['up', 'right'])
    expect([...actionsFromGamepad(pad([9]))]).toEqual(['menu'])
  })

  it('reads the left stick past the deadzone only', () => {
    expect([...actionsFromGamepad(pad([], [0.3, 0]))]).toEqual([])
    expect([...actionsFromGamepad(pad([], [-0.9, 0]))]).toEqual(['left'])
    expect([...actionsFromGamepad(pad([], [0, 0.9]))]).toEqual(['down'])
  })

  it('ignores a missing pad', () => {
    expect(actionsFromGamepad(null).size).toBe(0)
  })
})

describe('actionFromKey', () => {
  it('gives the keyboard the same vocabulary', () => {
    expect(actionFromKey('ArrowLeft')).toBe('left')
    expect(actionFromKey('Enter')).toBe('select')
    expect(actionFromKey('Escape')).toBe('back')
    expect(actionFromKey('KeyE')).toBe('confirm')
    expect(actionFromKey('Tab')).toBe('deck')
    expect(actionFromKey('KeyZ')).toBeUndefined()
  })
})

describe('createRepeater', () => {
  it('fires a button once per press, never on hold', () => {
    const r = createRepeater()
    expect(r.tick(new Set(['select']), 0)).toEqual(['select'])
    expect(r.tick(new Set(['select']), 1000)).toEqual([])
    expect(r.tick(new Set(), 1100)).toEqual([])
    expect(r.tick(new Set(['select']), 1200)).toEqual(['select'])
  })

  it('repeats a held direction after the delay, then at the rate', () => {
    const r = createRepeater()
    expect(r.tick(new Set(['right']), 0)).toEqual(['right'])
    expect(r.tick(new Set(['right']), REPEAT_DELAY_MS - 1)).toEqual([])
    expect(r.tick(new Set(['right']), REPEAT_DELAY_MS)).toEqual(['right'])
    expect(r.tick(new Set(['right']), REPEAT_DELAY_MS + REPEAT_RATE_MS - 1)).toEqual([])
    expect(r.tick(new Set(['right']), REPEAT_DELAY_MS + REPEAT_RATE_MS)).toEqual(['right'])
  })
})
