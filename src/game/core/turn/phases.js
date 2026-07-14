// The default turn structure, as data rather than a class hierarchy —
// inserting, removing, or reordering a phase later is an array edit here,
// not a change to TurnManager. Each phase's `run` receives a shared
// `context` object (see turnManager.js) built by whatever wires the game
// together (see game.js).
//
// 'build' and 'acquire' are intentionally gated, not auto-resolving: the
// actual playCard()/acquireFromRow() actions are explicit calls made by the
// caller (game.js's `actions`, or a test) while the current phase is
// active. TurnManager.assertPhase() is what enforces that gating.

import { resetAllSlotUsage, calcStatTotal, addTreasury, tickDisasterTimer, resetDisasterTimer } from '../state/playerState'
import { resolveTrigger } from '../effects/effectRegistry'
import { draw, discardCards } from '../piles/deck'
import { expireOldest } from '../piles/row'

export const DEFAULT_PHASES = [
  {
    name: 'draw',
    run: (ctx) => {
      resetAllSlotUsage(ctx.state)
      ctx.state.builtStructures.forEach(instance => {
        resolveTrigger(instance.card, 'onTurnStart', {
          state: ctx.state,
          catalog: ctx.catalog,
          log: ctx.log,
          instanceId: instance.instanceId
        })
      })

      const handSize = ctx.handSize ?? 5
      const needed = Math.max(0, handSize - ctx.state.hand.length)
      ctx.state.hand.push(...draw(ctx.state.deck, needed))
    }
  },
  {
    name: 'build',
    run: () => {
      // Gated phase: no automatic behavior. playCard() is only legal to
      // call while this phase is current.
    }
  },
  {
    name: 'acquire',
    run: () => {
      // Gated phase: no automatic behavior. acquireFromRow() is only legal
      // to call while this phase is current.
    }
  },
  {
    name: 'endOfTurn',
    run: (ctx) => {
      const revenue = calcStatTotal(ctx.state, 'revenue')
      addTreasury(ctx.state, revenue)
      ctx.log?.push(`+${revenue} revenue`)

      if (ctx.cityRow) expireOldest(ctx.cityRow)

      if (tickDisasterTimer(ctx.state)) {
        ctx.onDisasterDeadline?.(ctx.state)
        resetDisasterTimer(ctx.state)
      }

      ctx.checkGoals?.(ctx.state)
    }
  },
  {
    name: 'cleanup',
    run: (ctx) => {
      discardCards(ctx.state.deck, ctx.state.hand)
      ctx.state.hand = []
    }
  }
]
