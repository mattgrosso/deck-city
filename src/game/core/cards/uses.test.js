import { describe, it, expect } from 'vitest'
import { defaultUses, usesLeft, afterUse, isLimited } from './uses'
import { RESIDENTIAL, CRIME, ROAD } from './starterCards'
import { POLICE_STATION } from './facilityCards'

describe('card uses', () => {
  it('counts down a copy without touching the shared card, and is gone at zero', () => {
    expect(defaultUses(RESIDENTIAL)).toBe(3)
    const once = afterUse(RESIDENTIAL)
    expect(usesLeft(once)).toBe(2)
    expect(RESIDENTIAL.usesLeft).toBeUndefined()
    expect(afterUse(afterUse(once))).toBeNull()
  })
  it('gives facilities two plays, and never limits bad cards or roads', () => {
    expect(defaultUses(POLICE_STATION)).toBe(2)
    expect(isLimited(CRIME)).toBe(false)
    expect(afterUse(ROAD)).toBe(ROAD)
  })
  it('lets a card name its own uses', () => {
    expect(defaultUses({ type: 'building', tier: 1, uses: 5 })).toBe(5)
  })
})
