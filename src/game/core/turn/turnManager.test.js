import { describe, it, expect } from 'vitest'
import { createTurnManager, getCurrentPhase, advancePhase, runPhase, assertPhase } from './turnManager'

const testPhases = (calls) => [
  { name: 'a', run: () => calls.push('a') },
  { name: 'b', run: () => calls.push('b') },
  { name: 'c', run: () => calls.push('c') }
]

describe('createTurnManager', () => {
  it('starts at phase 0, turn 0', () => {
    const turnManager = createTurnManager({ phases: testPhases([]), state: {} })
    expect(turnManager.currentPhaseIndex).toBe(0)
    expect(turnManager.turnNumber).toBe(0)
    expect(getCurrentPhase(turnManager).name).toBe('a')
  })
})

describe('advancePhase', () => {
  it('runs the current phase and moves to the next', () => {
    const calls = []
    const turnManager = createTurnManager({ phases: testPhases(calls), state: {} })
    advancePhase(turnManager, {})
    expect(calls).toEqual(['a'])
    expect(getCurrentPhase(turnManager).name).toBe('b')
  })

  it('wraps around and increments turnNumber', () => {
    const calls = []
    const turnManager = createTurnManager({ phases: testPhases(calls), state: {} })
    advancePhase(turnManager, {})
    advancePhase(turnManager, {})
    advancePhase(turnManager, {})
    expect(calls).toEqual(['a', 'b', 'c'])
    expect(getCurrentPhase(turnManager).name).toBe('a')
    expect(turnManager.turnNumber).toBe(1)
  })
})

describe('runPhase', () => {
  it('runs a named phase out of sequence without changing currentPhaseIndex', () => {
    const calls = []
    const turnManager = createTurnManager({ phases: testPhases(calls), state: {} })
    runPhase(turnManager, 'c', {})
    expect(calls).toEqual(['c'])
    expect(turnManager.currentPhaseIndex).toBe(0)
  })

  it('throws for an unknown phase name', () => {
    const turnManager = createTurnManager({ phases: testPhases([]), state: {} })
    expect(() => runPhase(turnManager, 'nope', {})).toThrow(/Unknown phase/)
  })
})

describe('assertPhase', () => {
  it('does not throw when the named phase is current', () => {
    const turnManager = createTurnManager({ phases: testPhases([]), state: {} })
    expect(() => assertPhase(turnManager, 'a')).not.toThrow()
  })

  it('throws when the named phase is not current', () => {
    const turnManager = createTurnManager({ phases: testPhases([]), state: {} })
    expect(() => assertPhase(turnManager, 'b')).toThrow(/requires phase "b"/)
  })
})
