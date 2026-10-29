import { describe, it, expect } from 'vitest'
import './coreConditions'
import { evaluateCondition } from './conditionRegistry'
import { createPlayerState, buildStructure } from '../state/playerState'

const RESIDENTIAL = { id: 'residential', type: 'building', tags: ['residential'], stats: { population: 2 } }
const PARK = { id: 'park', type: 'building', tags: ['park'], stats: {} }
const POLICE = { id: 'police-station', type: 'building', tags: ['consumer'], stats: {} }

describe('populationAtLeast', () => {
  it('checks calcStatTotal population against the threshold', () => {
    const state = createPlayerState()
    buildStructure(state, RESIDENTIAL)
    expect(evaluateCondition({ type: 'populationAtLeast', amount: 2 }, { state })).toBe(true)
    expect(evaluateCondition({ type: 'populationAtLeast', amount: 3 }, { state })).toBe(false)
  })
})

describe('treasuryAtLeast', () => {
  it('checks current treasury, live', () => {
    const state = createPlayerState({ treasury: 8 })
    expect(evaluateCondition({ type: 'treasuryAtLeast', amount: 8 }, { state })).toBe(true)
    expect(evaluateCondition({ type: 'treasuryAtLeast', amount: 9 }, { state })).toBe(false)
  })
})

describe('buildingCountAtLeast', () => {
  it('counts built instances by card id', () => {
    const state = createPlayerState()
    buildStructure(state, POLICE)
    buildStructure(state, POLICE)
    expect(evaluateCondition({ type: 'buildingCountAtLeast', cardId: 'police-station', amount: 2 }, { state })).toBe(true)
    expect(evaluateCondition({ type: 'buildingCountAtLeast', cardId: 'police-station', amount: 3 }, { state })).toBe(false)
    expect(evaluateCondition({ type: 'buildingCountAtLeast', cardId: 'clinic', amount: 1 }, { state })).toBe(false)
  })
})

describe('statusCountAtMost', () => {
  it('counts a tag across draw pile, discard pile, and hand', () => {
    const state = createPlayerState()
    expect(evaluateCondition({ type: 'statusCountAtMost', tag: 'trash', amount: 0 }, { state })).toBe(true)

    state.deck.discardPile.push({ id: 'trash', tags: ['trash'] })
    expect(evaluateCondition({ type: 'statusCountAtMost', tag: 'trash', amount: 0 }, { state })).toBe(false)
    expect(evaluateCondition({ type: 'statusCountAtMost', tag: 'trash', amount: 1 }, { state })).toBe(true)
  })
})

describe('adjacentPair', () => {
  it('is true when an instance tagged tagA has a neighbor tagged tagB', () => {
    const state = createPlayerState()
    buildStructure(state, PARK, { position: { x: 2, y: 2 } })
    buildStructure(state, RESIDENTIAL, { position: { x: 2, y: 1 } })
    expect(evaluateCondition({ type: 'adjacentPair', tagA: 'park', tagB: 'residential' }, { state })).toBe(true)
  })

  it('is false when nothing qualifying is adjacent', () => {
    const state = createPlayerState()
    buildStructure(state, PARK, { position: { x: 2, y: 2 } })
    buildStructure(state, RESIDENTIAL, { position: { x: 0, y: 0 } })
    expect(evaluateCondition({ type: 'adjacentPair', tagA: 'park', tagB: 'residential' }, { state })).toBe(false)
  })
})

describe('adjacentChain', () => {
  it('detects an unbroken horizontal run of the given length', () => {
    const state = createPlayerState()
    buildStructure(state, RESIDENTIAL, { position: { x: 0, y: 0 } })
    buildStructure(state, RESIDENTIAL, { position: { x: 1, y: 0 } })
    buildStructure(state, RESIDENTIAL, { position: { x: 2, y: 0 } })
    expect(evaluateCondition({ type: 'adjacentChain', tag: 'residential', length: 3 }, { state })).toBe(true)
    expect(evaluateCondition({ type: 'adjacentChain', tag: 'residential', length: 4 }, { state })).toBe(false)
  })

  it('detects an unbroken vertical run', () => {
    const state = createPlayerState()
    buildStructure(state, RESIDENTIAL, { position: { x: 0, y: 0 } })
    buildStructure(state, RESIDENTIAL, { position: { x: 0, y: 1 } })
    expect(evaluateCondition({ type: 'adjacentChain', tag: 'residential', length: 2 }, { state })).toBe(true)
  })

  it('does not count a broken run as unbroken', () => {
    const state = createPlayerState()
    buildStructure(state, RESIDENTIAL, { position: { x: 0, y: 0 } })
    buildStructure(state, RESIDENTIAL, { position: { x: 2, y: 0 } }) // gap at x:1
    expect(evaluateCondition({ type: 'adjacentChain', tag: 'residential', length: 2 }, { state })).toBe(false)
  })
})

describe('all / any', () => {
  it('all requires every sub-condition to hold', () => {
    const state = createPlayerState({ treasury: 8 })
    buildStructure(state, RESIDENTIAL)
    const condition = {
      type: 'all',
      conditions: [{ type: 'populationAtLeast', amount: 2 }, { type: 'treasuryAtLeast', amount: 8 }]
    }
    expect(evaluateCondition(condition, { state })).toBe(true)

    const failing = {
      type: 'all',
      conditions: [{ type: 'populationAtLeast', amount: 2 }, { type: 'treasuryAtLeast', amount: 9 }]
    }
    expect(evaluateCondition(failing, { state })).toBe(false)
  })

  it('any requires at least one sub-condition to hold', () => {
    const state = createPlayerState({ treasury: 0 })
    const condition = {
      type: 'any',
      conditions: [{ type: 'populationAtLeast', amount: 999 }, { type: 'treasuryAtLeast', amount: 0 }]
    }
    expect(evaluateCondition(condition, { state })).toBe(true)

    const failing = {
      type: 'any',
      conditions: [{ type: 'populationAtLeast', amount: 999 }, { type: 'treasuryAtLeast', amount: 1 }]
    }
    expect(evaluateCondition(failing, { state })).toBe(false)
  })
})

describe('conditionProgress', () => {
  it('measures each leaf of a condition, counting toward or down to its target', async () => {
    const { conditionProgress } = await import('./coreConditions')
    const { createPlayerState, seedStructure } = await import('../state/playerState')
    const state = createPlayerState()
    seedStructure(state, { id: 'residential', name: 'R', type: 'building', tags: ['residential'], stats: { population: 2 } }, { x: 0, y: 0 })
    seedStructure(state, { id: 'residential', name: 'R', type: 'building', tags: ['residential'], stats: { population: 2 } }, { x: 1, y: 0 })
    const parts = conditionProgress({ type: 'all', conditions: [{ type: 'populationAtLeast', amount: 10 }, { type: 'adjacentChain', tag: 'residential', length: 3 }] }, { state })
    expect(parts.map(p => [p.current, p.target, p.met])).toEqual([[4, 10, false], [2, 3, false]])
    const clean = conditionProgress({ type: 'statusCountAtMost', tag: 'trash', amount: 0 }, { state })[0]
    expect(clean).toMatchObject({ current: 0, target: 0, atMost: true, met: true })
  })
})
