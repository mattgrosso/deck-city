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
  resetDisasterTimer,
  getAdjacentInstances,
  headOffDisaster,
  raiseTreasuryRolloverCap,
  seedStructure,
  instanceStats,
  previewPlacement
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

  it('roads one edge without occupying a cell, and returns the card to discard', () => {
    const state = createPlayerState()
    placeRoad(state, ROAD, { edge: 'h:0,0' })

    expect(isCellEmpty(state.cityGrid, 0, 0)).toBe(true)
    expect(isBuildable(state.cityGrid, 0, 0)).toBe(true)
    expect(isBuildable(state.cityGrid, 1, 0)).toBe(false)
    expect(state.builtStructures).toEqual([])
    expect(state.deck.discardPile).toEqual([ROAD])
  })

  it('resolves onBuild effects, same as buildStructure', () => {
    const calls = []
    registerEffect('test.onRoadBuild', () => calls.push('called'))
    const roadWithEffect = { ...ROAD, effects: { onBuild: [{ type: 'test.onRoadBuild' }] } }
    const state = createPlayerState()

    placeRoad(state, roadWithEffect, { edge: 'v:1,1' })

    expect(calls).toEqual(['called'])
  })
})

describe('createPlayerState starting roads', () => {
  it('seeds a starting road patch so some cells are buildable turn one', () => {
    const state = createPlayerState()
    expect(isBuildable(state.cityGrid, 5, 3)).toBe(true)
    expect(isBuildable(state.cityGrid, 6, 3)).toBe(true)
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

describe('getAdjacentInstances', () => {
  it('returns only the orthogonal neighbors that are actually built', () => {
    const state = createPlayerState()
    const center = buildStructure(state, BUILDING, { position: { x: 2, y: 2 } })
    const north = buildStructure(state, BUILDING, { position: { x: 2, y: 1 } })
    const east = buildStructure(state, BUILDING, { position: { x: 3, y: 2 } })
    // (2,3) south and (1,2) west are left empty.

    const neighbors = getAdjacentInstances(state, center.instanceId)

    expect(neighbors).toHaveLength(2)
    expect(neighbors).toEqual(expect.arrayContaining([north, east]))
  })

  it('returns an empty array for an instance with no position', () => {
    const state = createPlayerState()
    const instance = buildStructure(state, BUILDING) // no context.position
    expect(getAdjacentInstances(state, instance.instanceId)).toEqual([])
  })
})

describe('calcStatTotal adjacency bonuses', () => {
  const PARK = {
    id: 'park', type: 'building', name: 'Park', stats: {},
    adjacency: { statBonus: [{ stat: 'revenue', amount: 1, targetTag: 'residential' }] }
  }
  const RESIDENTIAL_TAGGED = { id: 'residential', type: 'building', name: 'Residential', tags: ['residential'], stats: { revenue: 1 } }

  it("adds a neighbor's bonus per matching adjacent tag, on top of base stats", () => {
    const state = createPlayerState()
    buildStructure(state, PARK, { position: { x: 2, y: 2 } })
    buildStructure(state, RESIDENTIAL_TAGGED, { position: { x: 2, y: 1 } }) // north of Park
    buildStructure(state, RESIDENTIAL_TAGGED, { position: { x: 3, y: 2 } }) // east of Park

    // base: 1 + 1 = 2, plus Park's +1 to each of its 2 adjacent Residential = +2
    expect(calcStatTotal(state, 'revenue')).toBe(4)
  })

  it('grants nothing when no qualifying neighbor is adjacent', () => {
    const state = createPlayerState()
    buildStructure(state, PARK, { position: { x: 2, y: 2 } })
    buildStructure(state, RESIDENTIAL_TAGGED, { position: { x: 0, y: 0 } }) // not adjacent

    expect(calcStatTotal(state, 'revenue')).toBe(1) // just the Residential's own base stat
  })
})

describe('treasury rollover cap', () => {
  it('raiseTreasuryRolloverCap sets the cap', () => {
    const state = createPlayerState()
    raiseTreasuryRolloverCap(state, 10)
    expect(state.treasuryRolloverCap).toBe(10)
  })

  it('never lowers an already-higher cap', () => {
    const state = createPlayerState()
    raiseTreasuryRolloverCap(state, 10)
    raiseTreasuryRolloverCap(state, 3)
    expect(state.treasuryRolloverCap).toBe(10)
  })
})

describe('headOffDisaster', () => {
  it('permanently freezes the disaster timer', () => {
    const state = createPlayerState()
    headOffDisaster(state)
    expect(state.disasterTimer.headedOff).toBe(true)
    expect(tickDisasterTimer(state)).toBe(false)
    expect(state.disasterTimer.turnsUntilDeadline).toBe(4) // untouched, not just reset
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
    expect(state.disasterTimer).toMatchObject({ turnsUntilDeadline: 4, headedOff: false })
  })
})

describe('instanceStats / previewPlacement', () => {
  const HOUSE = { id: 'h', type: 'building', name: 'House', tags: ['residential'], stats: { population: 2 }, adjacency: { statBonus: [{ stat: 'population', amount: 1, targetTag: 'residential' }, { stat: 'population', amount: -1, targetTag: 'industrial' }] } }
  const FACTORY = { id: 'f', type: 'building', name: 'Factory', tags: ['industrial'], stats: { jobs: 3 } }

  it('counts neighbours into a building, never below zero', () => {
    const state = createPlayerState()
    const a = seedStructure(state, HOUSE, { x: 0, y: 0 })
    seedStructure(state, HOUSE, { x: 1, y: 0 })
    expect(instanceStats(state, a).total.population).toBe(3)
    seedStructure(state, FACTORY, { x: 0, y: 1 })
    expect(instanceStats(state, a).total.population).toBe(2)
    const lonely = seedStructure(state, { ...HOUSE, stats: { population: 0 } }, { x: 5, y: 5 })
    seedStructure(state, FACTORY, { x: 5, y: 6 })
    expect(instanceStats(state, lonely).total.population).toBe(0)
    expect(calcStatTotal(state, 'population')).toBe(5) // first house 2+1-1, second 2+1, lonely house 0
  })

  it('previews a placement without changing the city', () => {
    const state = createPlayerState()
    seedStructure(state, HOUSE, { x: 0, y: 0 })
    const before = calcStatTotal(state, 'population')
    const p = previewPlacement(state, HOUSE, { x: 1, y: 0 })
    expect(p.own.population).toBe(3)
    expect(p.neighbours).toEqual([{ instanceId: expect.any(String), position: { x: 0, y: 0 }, name: 'House', delta: { population: 1 } }])
    expect(p.delta.population).toBe(4)
    expect(calcStatTotal(state, 'population')).toBe(before)
    expect(state.builtStructures).toHaveLength(1)
    expect(state.cityGrid.cells[1]).toBeNull()
  })
})
