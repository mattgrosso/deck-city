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

import {
  resetAllSlotUsage, calcStatTotal, tickDisasterTimer, resetDisasterTimer, countDisasterBlockers, sumPassive, calcUpkeep
} from '../state/playerState'
import { resolveTrigger } from '../effects/effectRegistry'
import { draw, discardCards, addToDrawPile, addToDiscardPile, shuffle } from '../piles/deck'
import { expireOldest, expireLowestValue, tickTimers } from '../piles/row'
import { drainPatience } from './run'

/**
 * Shuffles a random disaster card (from ctx.disasterCards, resolved by
 * game.js at setup) into the player's draw pile — the payoff for the
 * disaster timer reaching its deadline unheaded-off. Cards use the same
 * onDraw-trigger mechanism as any other card (see the 'draw' phase below),
 * so a disaster's actual bite (treasury loss, a status spike, ...) is
 * ordinary card data, not special-cased here.
 */
function triggerDisaster (ctx) {
  const pool = ctx.disasterCards ?? []
  if (!pool.length) return []
  const timer = ctx.state.disasterTimer
  timer.strikes = (timer.strikes ?? 0) + 1
  const blockers = countDisasterBlockers(ctx.state)
  // Escalates within an era, capped (ctx.maxDisasterCards, default 3); a run resets strikes each era.
  const count = Math.max(0, Math.min(timer.strikes, ctx.maxDisasterCards ?? 3) - blockers)
  const cards = []
  for (let i = 0; i < count; i++) cards.push(pool[Math.floor(ctx.state.deck.rng() * pool.length)])
  if (cards.length) {
    addToDrawPile(ctx.state.deck, cards)
    shuffle(ctx.state.deck)
  }
  const names = cards.map(c => c.name).join(' and ')
  const blocked = Math.min(blockers, timer.strikes)
  ctx.log?.push(
    count === 0
      ? `Disaster ${timer.strikes}: ${blockers} Fire Station${blockers === 1 ? '' : 's'} held it off.`
      : `Disaster ${timer.strikes}: ${names} shuffled into your deck${blocked ? ` (${blocked} blocked by Fire Station${blocked === 1 ? '' : 's'})` : ''}.`
  )
  return cards
}

/**
 * People without work turn to crime: at the end of a turn with more
 * population than jobs, one Crime card joins the deck. This is what jobs
 * are FOR (Matt: "I'm not sure what jobs means. Why do I care?").
 */
function unemployment (ctx) {
  const population = calcStatTotal(ctx.state, 'population')
  const jobs = calcStatTotal(ctx.state, 'jobs')
  const crime = ctx.catalog?.crime
  if (population <= jobs || !crime) return
  addToDiscardPile(ctx.state.deck, [crime])
  ctx.log?.push(`Unemployment: ${population} people, ${jobs} jobs. +1 Crime card.`)
}

/**
 * The city row grows with the city: when population reaches a tier's
 * threshold, that tier's cards are shuffled into the city deck (Matt: "a
 * much larger base of buildings, and probably they should be tiered").
 * ctx.cityTiers = [{ tier: 2, at: 8, cards: [...] }, ...].
 */
function unlockTiers (ctx) {
  if (!ctx.cityTiers?.length || !ctx.cityRow) return
  const pop = calcStatTotal(ctx.state, 'population')
  ctx.state.tiersUnlocked ??= [1]
  for (const t of ctx.cityTiers) {
    if (ctx.state.tiersUnlocked.includes(t.tier) || pop < t.at) continue
    ctx.state.tiersUnlocked.push(t.tier)
    addToDrawPile(ctx.cityRow.sourceDeck, t.cards)
    shuffle(ctx.cityRow.sourceDeck)
    ctx.log?.push(`The city reaches ${t.at} people: tier ${'I'.repeat(t.tier)} buildings come to market.`)
  }
}

/**
 * Win: population hits ctx.populationTarget, checked every turn,
 * independent of the goal deck. Lose: the goal deck's draw pile, discard
 * pile, and visible row are all simultaneously empty - there's nothing left
 * to ever claim. Both are terminal; once set, checkGameStatus is a no-op
 * (see its own early return), so a win latched in one turn can't flip to a
 * loss in a later one just because the goal deck later runs dry.
 */
function checkGameStatus (ctx) {
  if (ctx.state.gameStatus !== 'playing') return
  // In a run, elections decide (turn/run.js); the goal row is side projects.
  if (ctx.run) return

  if (calcStatTotal(ctx.state, 'population') >= (ctx.populationTarget ?? 20)) {
    ctx.state.gameStatus = 'won'
    ctx.log?.push(`Population target reached (${ctx.populationTarget ?? 20}) — you win!`)
    return
  }

  // ctx.hasGoals distinguishes "the goal deck was configured and has
  // genuinely run dry" from "no goal content was ever set up" (e.g. many
  // engine tests) - without it, an intentionally-empty goal row reads as
  // already-exhausted and ends the game immediately.
  if (ctx.goalRow && ctx.hasGoals) {
    const exhausted = ctx.goalRow.cards.length === 0 &&
      ctx.goalRow.sourceDeck.drawPile.length === 0 &&
      ctx.goalRow.sourceDeck.discardPile.length === 0
    if (exhausted) {
      ctx.state.gameStatus = 'lost'
      ctx.log?.push('The goal deck is exhausted with no population win in sight — game over.')
    }
  }
}

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

      // Budget hard-resets to current production at the START of turn (not
      // banked from end-of-turn revenue) - a deliberate departure from
      // typical deckbuilder treasury accumulation. treasuryRolloverCap (0
      // by default, raised by e.g. the City Bank goal) is the only escape
      // valve: up to that much of last turn's leftover carries forward.
      //
      // ctx.baseRevenue is flat municipal income on top of building
      // revenue - without it, turn 1 (zero buildings, zero revenue) resets
      // straight to 0 before the player can ever afford a first Road, which
      // a pure production-based reset can never recover from on its own.
      const fromBuildings = calcStatTotal(ctx.state, 'revenue')
      const base = ctx.baseRevenue ?? 0
      const upkeep = calcUpkeep(ctx.state)
      const revenue = Math.max(0, fromBuildings + base - upkeep)
      const rollover = Math.min(ctx.state.treasury, ctx.state.treasuryRolloverCap ?? 0)
      ctx.state.treasury = revenue + rollover
      ctx.state.goalsClaimedThisTurn = 0
      ctx.state.buys = (ctx.buysPerTurn ?? 1) + sumPassive(ctx.state, 'buysBonus')
      const parts = [`${fromBuildings} from buildings`]
      if (base) parts.push(`${base} base income`)
      if (upkeep) parts.push(`${upkeep} upkeep taken off`)
      if (rollover > 0) parts.push(`${rollover} kept from last turn`)
      ctx.log?.push(`Budget this turn: ${ctx.state.treasury} (${parts.join(' + ')}).`)

      const handSize = (ctx.handSize ?? 5) + sumPassive(ctx.state, 'handSizeBonus')
      const needed = Math.max(0, handSize - ctx.state.hand.length)
      const drawnCards = draw(ctx.state.deck, needed)
      // onDraw triggers resolve immediately as each card lands in hand -
      // this is what makes a disaster card (see triggerDisaster above)
      // actually bite instead of sitting inert once drawn.
      drawnCards.forEach(card => resolveTrigger(card, 'onDraw', { state: ctx.state, catalog: ctx.catalog, log: ctx.log }))
      ctx.state.hand.push(...drawnCards)
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
      // Gated phase: no automatic behavior. acquireFromRow()/claimGoal()
      // are only legal to call while this phase is current.
    }
  },
  {
    name: 'endOfTurn',
    run: (ctx) => {
      if (ctx.cityRow) expireOldest(ctx.cityRow)

      // Goals carry their own clocks (createRow's timerFor): each counts
      // down a turn and expires at zero. A row without clocks keeps the old
      // rule - the lowest tier goes every fourth turn.
      if (ctx.goalRow && ctx.goalRow.timerFor) {
        for (const expired of tickTimers(ctx.goalRow)) ctx.log?.push(`Goal expired, time ran out: ${expired.name}.`)
      } else if (ctx.goalRow && (ctx.turnManager.turnNumber + 1) % 4 === 0) {
        const expired = expireLowestValue(ctx.goalRow, card => card.tier ?? Infinity)
        if (expired) ctx.log?.push(`Goal expired unclaimed: ${expired.name}`)
      }

      unemployment(ctx)
      if (!ctx.run) unlockTiers(ctx)

      let struck = false
      if (tickDisasterTimer(ctx.state)) {
        triggerDisaster(ctx)
        resetDisasterTimer(ctx.state)
        struck = true
      }

      drainPatience(ctx, { struck })
      checkGameStatus(ctx)
    }
  },
  {
    name: 'cleanup',
    run: (ctx) => {
      // A disaster card bites once, when drawn, and then it is gone: the
      // city recovers. (When disasters stayed and bit again on every draw, a
      // long run filled the deck with hundreds of them - yarn selfplay.)
      discardCards(ctx.state.deck, ctx.state.hand.filter(c => c.type !== 'disaster'))
      ctx.state.hand = []
    }
  }
]
