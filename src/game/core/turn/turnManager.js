// Cycles through a list of phases (see phases.js). Owns only phase
// sequencing and turn counting — the phases themselves own all game rules.

import { DEFAULT_PHASES } from './phases'

/**
 * @param {Object} options
 * @param {Object[]} [options.phases]
 * @param {Object} options.state
 */
export function createTurnManager ({ phases = DEFAULT_PHASES, state } = {}) {
  return { phases, currentPhaseIndex: 0, state, turnNumber: 0 }
}

export function getCurrentPhase (turnManager) {
  return turnManager.phases[turnManager.currentPhaseIndex]
}

/**
 * Runs the current phase, then advances to the next one, wrapping around
 * and incrementing turnNumber when the cycle completes.
 * @param {Object} turnManager
 * @param {Object} context
 */
export function advancePhase (turnManager, context) {
  getCurrentPhase(turnManager).run(context)
  turnManager.currentPhaseIndex = (turnManager.currentPhaseIndex + 1) % turnManager.phases.length
  if (turnManager.currentPhaseIndex === 0) turnManager.turnNumber += 1
  return turnManager
}

/**
 * Re-runs a named phase out of sequence — useful in tests, or for a phase
 * that needs to be retriggered.
 * @param {Object} turnManager
 * @param {string} phaseName
 * @param {Object} context
 */
export function runPhase (turnManager, phaseName, context) {
  const phase = turnManager.phases.find(candidate => candidate.name === phaseName)
  if (!phase) throw new Error(`Unknown phase: "${phaseName}"`)
  phase.run(context)
  return turnManager
}

/**
 * Throws unless the given phase is currently active. This is the gating
 * mechanism for actions like playCard()/acquireFromRow() that should only
 * be callable during a specific phase.
 * @param {Object} turnManager
 * @param {string} phaseName
 */
export function assertPhase (turnManager, phaseName) {
  const current = getCurrentPhase(turnManager)
  if (current.name !== phaseName) {
    throw new Error(`Action requires phase "${phaseName}", but current phase is "${current.name}"`)
  }
}
