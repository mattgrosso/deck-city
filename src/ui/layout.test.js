import { describe, it, expect } from 'vitest'
import { fanLayout, stepCursor, nearestCell, CARD_W, FOCUS_SCALE } from './layout'

describe('fanLayout', () => {
  it('centres a single card with no tilt', () => {
    const [card] = fanLayout(1, null)
    expect(card.x).toBe(0)
    expect(card.rot).toBe(0)
  })

  it('spreads cards symmetrically and leans the outer ones outward', () => {
    const cards = fanLayout(5, null)
    expect(cards[0].x).toBeCloseTo(-cards[4].x)
    expect(cards[0].rot).toBeLessThan(0)
    expect(cards[4].rot).toBeGreaterThan(0)
    expect(cards[2].rot).toBe(0)
    expect(cards[0].y).toBeGreaterThan(cards[2].y) // outer cards sit lower
  })

  it('raises, straightens and enlarges the focused card and pushes neighbours apart', () => {
    const rest = fanLayout(5, null)
    const focus = fanLayout(5, 2)
    expect(focus[2].scale).toBe(FOCUS_SCALE)
    expect(focus[2].rot).toBe(0)
    expect(focus[2].y).toBeLessThan(rest[2].y)
    expect(focus[1].x).toBeLessThan(rest[1].x)
    expect(focus[3].x).toBeGreaterThan(rest[3].x)
    // The big card never overlaps a neighbour's centre.
    expect(focus[3].x - focus[2].x).toBeGreaterThan((CARD_W * FOCUS_SCALE) / 2)
    expect(focus[2].z).toBeGreaterThan(focus[4].z)
  })

  it('keeps ten cards inside the room it is given', () => {
    const cards = fanLayout(10, null, { width: 1100 })
    expect(cards[9].x - cards[0].x).toBeLessThanOrEqual(1100)
  })
})

describe('stepCursor', () => {
  const valid = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 3 }]

  it('moves to the nearest valid cell in the pressed direction', () => {
    expect(stepCursor({ x: 0, y: 0 }, 'right', valid)).toEqual({ x: 2, y: 0 })
    expect(stepCursor({ x: 2, y: 0 }, 'down', valid)).toEqual({ x: 2, y: 2 })
  })

  it('prefers a straight walk over a sideways drift', () => {
    expect(stepCursor({ x: 0, y: 0 }, 'down', valid)).toEqual({ x: 0, y: 3 })
  })

  it('stays put when nothing lies that way', () => {
    expect(stepCursor({ x: 0, y: 0 }, 'up', valid)).toEqual({ x: 0, y: 0 })
    expect(stepCursor({ x: 0, y: 0 }, 'left', valid)).toEqual({ x: 0, y: 0 })
  })
})

describe('nearestCell', () => {
  it('finds the closest valid cell by walking distance', () => {
    expect(nearestCell({ x: 1, y: 1 }, [{ x: 5, y: 5 }, { x: 2, y: 1 }])).toEqual({ x: 2, y: 1 })
    expect(nearestCell({ x: 1, y: 1 }, [])).toBeNull()
  })
})
