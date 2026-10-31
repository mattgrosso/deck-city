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
  calcStatTotal, tickDisasterTimer, resetDisasterTimer, countDisasterBlockers, sumPassive, calcUpkeep
} from '../state/playerState'
import { resolveTrigger } from '../effects/effectRegistry'
import { draw, discardCards, addToDrawPile, addToDiscardPile, shuffle } from '../piles/deck'
import { expireOldest, expireLowestValue, tickTimers } from '../piles/row'
import { drainPatience } from './run'
import { beginTurn } from '../effects/synergy'
import { policyMod, policyBudget } from '../cards/policies'

/** Turns in a month. The market opens in the last week (Matt, 2026-10-31: "each one is a week and every month you get a new card offer"). */
export const MONTH = 4

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
      ctx.state.builtStructures.forEach(instance => {
        resolveTrigger(instance.card, 'onTurnStart', {
          state: ctx.state,
          catalog: ctx.catalog,
          log: ctx.log,
          instanceId: instance.instanceId
        })
      })

      // Unspent budget carries over in full (2026-10-31): the market opens
      // only at month's end (game.js, MONTH), so saving for it is the
      // choice. (It used to reset every turn, which made playing the whole
      // hand always right.) The Rainy Day Fund pays interest on savings.
      //
      // ctx.baseRevenue is flat municipal income on top of building
      // revenue - without it, turn 1 (zero buildings, zero revenue) resets
      // straight to 0 before the player can ever afford a first Road, which
      // a pure production-based reset can never recover from on its own.
      beginTurn(ctx.state) // a new turn: nothing played or built yet (synergy.js)
      const fromBuildings = calcStatTotal(ctx.state, 'revenue')
      const base = ctx.baseRevenue ?? 0
      const upkeep = calcUpkeep(ctx.state)
      const fromPolicies = policyBudget(ctx.state) // Tax Reform, Merchant Guild
      const revenue = fromBuildings + base + fromPolicies - upkeep // may be negative: upkeep comes out of savings
      const rollover = ctx.state.treasury
      const interest = Math.min(5, Math.floor(rollover / 10) * policyMod(ctx.state, 'interest')) // Rainy Day Fund, at most +5
      ctx.state.week = (ctx.turnManager?.turnNumber ?? 0) % MONTH + 1 // weeks 1-4; the market opens in week 4
      if (ctx.state.week === 1) ctx.state.monthOffered = false
      const total = revenue + rollover + interest
      ctx.state.treasury = Math.max(0, total)
      // Upkeep you can't pay becomes a Debt card (a Bank Branch or Courthouse clears it).
      if (total < 0 && ctx.catalog?.debt) {
        addToDiscardPile(ctx.state.deck, [ctx.catalog.debt])
        ctx.log?.push(`Upkeep ran ${-total} past your savings: +1 Debt card.`)
      }
      ctx.state.goalsClaimedThisTurn = 0
      ctx.state.buys = (ctx.buysPerTurn ?? 1) + sumPassive(ctx.state, 'buysBonus') + policyMod(ctx.state, 'buys')
      // Month's end: buy as much as you can afford (the market only opens then).
      if (ctx.state.week === MONTH) ctx.state.buys = 99
      const parts = [`${fromBuildings} from buildings`]
      if (base) parts.push(`${base} base income`)
      if (fromPolicies) parts.push(`${fromPolicies} from policies`)
      if (upkeep) parts.push(`${upkeep} upkeep taken off`)
      if (rollover > 0) parts.push(`${rollover} kept from last turn`)
      ctx.log?.push(`Budget this turn: ${ctx.state.treasury} (${parts.join(' + ')}).`)
      // The same, as numbers, for the overnight ledger (App: SummaryPanel).
      ctx.state.lastBudget = { total: ctx.state.treasury, parts: [['Revenue from your buildings', fromBuildings], ['Base income', base], ['Policies', fromPolicies], ['Upkeep', -upkeep], ['Kept from last turn', rollover]].filter(([, n]) => n) }

      const handSize = Math.max(1, (ctx.handSize ?? 5) + sumPassive(ctx.state, 'handSizeBonus') + policyMod(ctx.state, 'handSize'))
      const needed = Math.max(0, handSize - ctx.state.hand.length)
      // onDraw triggers resolve immediately as each card lands in hand -
      // this is what makes a disaster card (see triggerDisaster above) bite.
      // A disaster then leaves at once and another card is drawn in its
      // place (Matt, 2026-10-31: "these flood cards they just last forever"):
      // it never sits in your hand, and the strike shows in the log.
      let want = needed
      for (let guard = 0; want > 0 && guard < 20; guard++) {
        const drawnCards = draw(ctx.state.deck, want)
        if (!drawnCards.length) break
        drawnCards.forEach(card => resolveTrigger(card, 'onDraw', { state: ctx.state, catalog: ctx.catalog, log: ctx.log }))
        const kept = drawnCards.filter(card => card.type !== 'disaster')
        for (const card of drawnCards) if (card.type === 'disaster') ctx.log?.push(`${card.name} struck, and passed.`)
        ctx.state.hand.push(...kept)
        want -= kept.length
      }
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
      // The city row turns over at month's end, after the market (MONTH).
      if (ctx.cityRow && ctx.state.week === MONTH) { expireOldest(ctx.cityRow); expireOldest(ctx.cityRow) }

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
        ctx.state.disasterTimer.turnsUntilDeadline += policyMod(ctx.state, 'disasterDelay') // Fire Code
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
