// The starter goal-condition vocabulary. Each evaluator reads state, never
// mutates it. Importing this module registers its conditions as a side
// effect, same convention as effects/coreEffects.js — consumers just need
// `import './coreConditions'` (or import it via game/core/index.js) once
// before evaluating any goal's condition.

import { registerCondition, evaluateCondition } from './conditionRegistry'
import { calcStatTotal, countCardsByTag, getAdjacentInstances } from '../state/playerState'

/** condition: { type: 'populationAtLeast', amount } */
registerCondition('populationAtLeast', ({ amount }, { state }) => {
  return calcStatTotal(state, 'population') >= amount
})

/**
 * condition: { type: 'treasuryAtLeast', amount } - checked live, so it's
 * only true on a turn where the player's current budget (see the 'draw'
 * phase's hard reset) actually reaches the threshold, not "ever reached
 * historically." That's deliberate: it's what makes City Bank
 * (cards/goalCards.js) feel like it's rewarding a strong turn, not a
 * stockpile.
 */
registerCondition('treasuryAtLeast', ({ amount }, { state }) => {
  return state.treasury >= amount
})

/** condition: { type: 'buildingCountAtLeast', cardId, amount } */
registerCondition('buildingCountAtLeast', ({ cardId, amount }, { state }) => {
  const count = state.builtStructures.filter(instance => instance.card.id === cardId).length
  return count >= amount
})

/**
 * condition: { type: 'statusCountAtMost', tag, amount } - counts a status
 * card's presence across draw pile, discard pile, and hand combined (see
 * countCardsByTag), same "wherever it currently is in the deck" scope
 * consumeStatus already uses.
 */
registerCondition('statusCountAtMost', ({ tag, amount }, { state }) => {
  return countCardsByTag(state, tag) <= amount
})

/**
 * condition: { type: 'adjacentPair', tagA, tagB } - true if any built
 * instance tagged tagA has an orthogonal neighbor tagged tagB. Adjacency is
 * symmetric, so this covers "B next to A" too without a second check.
 */
registerCondition('adjacentPair', ({ tagA, tagB }, { state }) => {
  return state.builtStructures.some(instance => {
    if (!instance.card.tags?.includes(tagA)) return false
    const neighbors = getAdjacentInstances(state, instance.instanceId)
    return neighbors.some(neighbor => neighbor.card.tags?.includes(tagB))
  })
})

/**
 * The longest run of grid-adjacent built instances tagged `tag`, walking in
 * one direction (dx, dy). Only counts a run from its head (the cell whose
 * predecessor isn't part of the same run) so each run is measured once.
 */
function longestRun (state, tag, dx, dy) {
  const positions = new Set(
    state.builtStructures
      .filter(instance => instance.position && instance.card.tags?.includes(tag))
      .map(instance => `${instance.position.x},${instance.position.y}`)
  )

  let longest = 0
  positions.forEach(key => {
    const [x, y] = key.split(',').map(Number)
    if (positions.has(`${x - dx},${y - dy}`)) return // not a run head

    let runLength = 0
    let cx = x
    let cy = y
    while (positions.has(`${cx},${cy}`)) {
      runLength += 1
      cx += dx
      cy += dy
    }
    longest = Math.max(longest, runLength)
  })

  return longest
}

/**
 * condition: { type: 'adjacentChain', tag, length } - true if `length` or
 * more grid-adjacent built instances tagged `tag` form an unbroken
 * horizontal or vertical line.
 */
registerCondition('adjacentChain', ({ tag, length }, { state }) => {
  return longestRun(state, tag, 1, 0) >= length || longestRun(state, tag, 0, 1) >= length
})

/** condition: { type: 'all', conditions: [...] } */
registerCondition('all', ({ conditions }, context) => {
  return conditions.every(condition => evaluateCondition(condition, context))
})

/** condition: { type: 'any', conditions: [...] } */
registerCondition('any', ({ conditions }, context) => {
  return conditions.some(condition => evaluateCondition(condition, context))
})
