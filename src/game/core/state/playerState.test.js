import { describe, it, expect } from 'vitest'
import { registerEffect } from '../effects/effectRegistry'
import { isBuildable, isCellEmpty } from './cityGrid'
import {
  createPlayerState,
  addTreasury,
  spendTreasury,
  addStatusCard,
  removeStatusCard,
  calcStatTotal,
  countCardsByTag,
  buildStructure,
  placeRoad,
  expandSlots,
  resetSlotUsage,
  resetAllSlotUsage,
  addGoal,
  completeGoal,
  tickDisasterTimer,
  resetDisasterTimer
} from './playerState'

const BUILDING = { id: 'residential', type: 'building', name: 'Residential', stats: { population: 2, revenue: 1 } }
const CRIME = { id: 'crime', type: 'status', name: 'Crime', tags: ['negative'] }
const CONSUMER = {
  id: 'clinic', type: 'building', name: 'Clinic',
  slots: { capacity: 2, expandable: true, maxMultiplier: 2 }
}

describe('treasury', () => {
  it('adds and spends', () => {
    const state = createPlayerState({ treasury: 5 })
    addTreasury(state, 3)
    expect(state.treasury).toBe(8)
    spendTreasury(state, 8)
    expect(state.treasury).toBe(0)
  })

  it('throws on overspend', () => {
    const state = createPlayerState({ treasury: 1 })
    expect(() => spendTreasury(state, 2)).toThrow()
  })
})

describe('status cards', () => {
  it('addStatusCard pushes copies into the discard pile', () => {
    const state = createPlayerState()
    addStatusCard(state, CRIME, 2)
    expect(state.deck.discardPile).toEqual([CRIME, CRIME])
  })

  it('removeStatusCard removes from discard, then draw, then hand', () => {
    const state = createPlayerState()
    state.deck.discardPile.push(CRIME)
    state.deck.drawPile.push(CRIME)
    state.hand.push(CRIME)

    const removed = removeStatusCard(state, 'crime', 2)

    expect(removed).toBe(2)
    expect(state.deck.discardPile).toEqual([])
    expect(state.deck.drawPile).toEqual([])
    expect(state.hand).toEqual([CRIME])
  })

  it('removeStatusCard with requiresSlot stops once the instance is full', () => {
    const state = createPlayerState()
    const instance = buildStructure(state, CONSUMER)
    state.deck.discardPile.push(CRIME, CRIME, CRIME)

    const removed = removeStatusCard(state, 'crime', 3, { requiresSlot: true, buildingId: instance.instanceId })

    expect(removed).toBe(2) // CONSUMER capacity is 2
    expect(instance.slots.used).toBe(2)
    // CONSUMER itself is in the discard pile too, from buildStructure()
    // returning the played card there; only CRIME copies are consumed.
    expect(state.deck.discardPile).toEqual([CONSUMER, CRIME])
  })

  it('removeStatusCard with requiresSlot on an unknown instance removes nothing', () => {
    const state = createPlayerState()
    state.deck.discardPile.push(CRIME)
    const removed = removeStatusCard(state, 'crime', 1, { requiresSlot: true, buildingId: 'no-such-instance' })
    expect(removed).toBe(0)
    expect(state.deck.discardPile).toEqual([CRIME])
  })
})

describe('calcStatTotal / countCardsByTag', () => {
  it('sums a stat across built structures', () => {
    const state = createPlayerState()
    buildStructure(state, BUILDING)
    buildStructure(state, BUILDING)
    expect(calcStatTotal(state, 'population')).toBe(4)
    expect(calcStatTotal(state, 'revenue')).toBe(2)
    expect(calcStatTotal(state, 'unknown-stat')).toBe(0)
  })

  it('counts tagged cards across draw pile, discard pile, and hand', () => {
    const state = createPlayerState()
    state.deck.drawPile.push(CRIME)
    state.deck.discardPile.push(CRIME)
    state.hand.push(CRIME)
    expect(countCardsByTag(state, 'negative')).toBe(3)
    expect(countCardsByTag(state, 'positive')).toBe(0)
  })
})

describe('buildStructure', () => {
  it('adds a built instance and returns the card to the discard pile', () => {
    const state = createPlayerState()
    const instance = buildStructure(state, BUILDING)

    expect(state.builtStructures).toEqual([instance])
    expect(instance.card).toBe(BUILDING)
    expect(state.deck.discardPile).toEqual([BUILDING])
  })

  it('sets up slots for consumer buildings', () => {
    const state = createPlayerState()
    const instance = buildStructure(state, CONSUMER)
    expect(instance.slots).toEqual({ capacity: 2, used: 0 })
  })

  it('resolves onBuild effects', () => {
    const calls = []
    registerEffect('test.onBuild', (effect, context) => calls.push(context.state.treasury))
    const built = {
      id: 'building-with-effect',
      type: 'building',
      stats: {},
      effects: { onBuild: [{ type: 'test.onBuild' }] }
    }
    const state = createPlayerState({ treasury: 7 })

    buildStructure(state, built)

    expect(calls).toEqual([7])
  })
})

describe('placeRoad', () => {
  const ROAD = { id: 'road', type: 'building', name: 'Road', placesRoad: true }

  it('roads the target cell without occupying it, and returns the card to discard', () => {
    const state = createPlayerState()
    placeRoad(state, ROAD, { position: { x: 0, y: 0 } })

    expect(isCellEmpty(state.cityGrid, 0, 0)).toBe(true)
    expect(isBuildable(state.cityGrid, 0, 0)).toBe(true)
    expect(state.builtStructures).toEqual([])
    expect(state.deck.discardPile).toEqual([ROAD])
  })

  it('resolves onBuild effects, same as buildStructure', () => {
    const calls = []
    registerEffect('test.onRoadBuild', () => calls.push('called'))
    const roadWithEffect = { ...ROAD, effects: { onBuild: [{ type: 'test.onRoadBuild' }] } }
    const state = createPlayerState()

    placeRoad(state, roadWithEffect, { position: { x: 1, y: 1 } })

    expect(calls).toEqual(['called'])
  })
})

describe('createPlayerState starting roads', () => {
  it('seeds a starting road patch so some cells are buildable turn one', () => {
    const state = createPlayerState()
    expect(isBuildable(state.cityGrid, 2, 1)).toBe(true)
    expect(isBuildable(state.cityGrid, 3, 1)).toBe(true)
  })
})

describe('slots', () => {
  it('expandSlots respects maxMultiplier', () => {
    const state = createPlayerState()
    const instance = buildStructure(state, CONSUMER)
    expandSlots(state, instance.instanceId, 1)
    expect(instance.slots.capacity).toBe(3)
    expandSlots(state, instance.instanceId, 10)
    expect(instance.slots.capacity).toBe(4) // capped at capacity(2) * maxMultiplier(2)
  })

  it('resetSlotUsage / resetAllSlotUsage zero out usage', () => {
    const state = createPlayerState()
    const a = buildStructure(state, CONSUMER)
    const b = buildStructure(state, CONSUMER)
    a.slots.used = 2
    b.slots.used = 1
    resetSlotUsage(state, a.instanceId)
    expect(a.slots.used).toBe(0)
    expect(b.slots.used).toBe(1)
    resetAllSlotUsage(state)
    expect(b.slots.used).toBe(0)
  })
})

describe('goals', () => {
  it('addGoal / completeGoal move a goal from active to completed', () => {
    const state = createPlayerState()
    const goal = { id: 'goal-1', effects: {} }
    addGoal(state, goal)
    expect(state.goals.active).toEqual([goal])

    const completed = completeGoal(state, 'goal-1')
    expect(completed).toBe(goal)
    expect(state.goals.active).toEqual([])
    expect(state.goals.completed).toEqual([goal])
  })

  it('completeGoal returns undefined for an unknown goal', () => {
    const state = createPlayerState()
    expect(completeGoal(state, 'no-such-goal')).toBeUndefined()
  })
})

describe('disaster timer', () => {
  it('ticks down and reports reaching the deadline', () => {
    const state = createPlayerState()
    expect(tickDisasterTimer(state)).toBe(false)
    expect(tickDisasterTimer(state)).toBe(false)
    expect(tickDisasterTimer(state)).toBe(false)
    expect(tickDisasterTimer(state)).toBe(true) // 4 -> 0
  })

  it('does not tick once headed off', () => {
    const state = createPlayerState()
    state.disasterTimer.headedOff = true
    expect(tickDisasterTimer(state)).toBe(false)
    expect(state.disasterTimer.turnsUntilDeadline).toBe(4)
  })

  it('resetDisasterTimer restores the deadline and clears headedOff', () => {
    const state = createPlayerState()
    state.disasterTimer.turnsUntilDeadline = 0
    state.disasterTimer.headedOff = true
    resetDisasterTimer(state)
    expect(state.disasterTimer).toEqual({ turnsUntilDeadline: 4, headedOff: false })
  })
})
