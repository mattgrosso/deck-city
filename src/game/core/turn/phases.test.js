import { describe, it, expect } from 'vitest'
import { seedStructure } from '../state/playerState'
import '../effects/coreEffects'
import '../conditions/coreConditions'
import { DEFAULT_PHASES } from './phases'
import { createTurnManager } from './turnManager'
import { createPlayerState, buildStructure } from '../state/playerState'
import { createDeck } from '../piles/deck'
import { createRow } from '../piles/row'
import { buildCardCatalog } from '../cards/cardSchema'
import { CLINIC, CRIME, ROAD } from '../cards/exampleCards'

const catalog = buildCardCatalog([CLINIC, CRIME, ROAD])
const phase = (name) => DEFAULT_PHASES.find(p => p.name === name)

describe('draw phase', () => {
  it('keeps slot usage (a facility fills up for good), resolves onTurnStart effects, then draws up to hand size', () => {
    const state = createPlayerState({ startingDeckCards: [ROAD, ROAD, ROAD] })
    const instance = buildStructure(state, CLINIC, { catalog })
    instance.slots.used = 2 // what it took before: it stays taken
    state.deck.discardPile.push(CRIME)

    phase('draw').run({ state, catalog, handSize: 2 })

    // Nothing refills it (2026-10-31): usage carries over and onTurnStart's
    // consumeStatus adds one more.
    expect(instance.slots.used).toBe(3)
    // CLINIC itself is in the discard pile too — buildStructure() returns
    // the played card there as part of building it — only CRIME is consumed.
    expect(state.deck.discardPile.map(c => c.id)).toEqual([CLINIC.id])
    expect(state.hand).toHaveLength(2)
  })

  it('resets treasury to building revenue + base revenue, ignoring whatever treasury was before', () => {
    const state = createPlayerState({ treasury: 999 })
    buildStructure(state, { id: 'shop', type: 'building', stats: { revenue: 3 } })

    phase('draw').run({ state, catalog: {}, log: [], baseRevenue: 4 })

    expect(state.treasury).toBe(3 + 4)
  })

  it('carries forward leftover treasury up to the rollover cap, on top of the reset', () => {
    const state = createPlayerState({ treasury: 20 })
    state.treasuryRolloverCap = 5

    phase('draw').run({ state, catalog: {}, log: [], baseRevenue: 4 })

    // min(20, 5) rollover + 0 revenue + 4 base
    expect(state.treasury).toBe(5 + 4)
  })

  it('a disaster bites the moment it is drawn, then leaves and another card takes its place', () => {
    const disaster = { id: 'flood', type: 'disaster', name: 'Flood', effects: { onDraw: [{ type: 'spendTreasury', amount: 3 }] } }
    const state = createPlayerState({ startingDeckCards: [disaster, ROAD] })
    state.deck.drawPile = [ROAD, disaster] // draws from the end: the Flood comes first
    const log = []

    phase('draw').run({ state, catalog: {}, log, baseRevenue: 4, handSize: 1 })

    expect(state.hand.map(c => c.id)).toEqual(['road'])
    expect(state.treasury).toBe(4 - 3)
    expect(log).toContain('Flood struck, and passed.')
  })
})

describe('endOfTurn phase', () => {
  it('expires the oldest city row card and ticks the disaster timer, without touching treasury', () => {
    const state = createPlayerState({ treasury: 7 })
    const sourceDeck = createDeck({ id: 'city', cards: [{ id: 'x1' }, { id: 'x2' }, { id: 'x3' }, { id: 'x4' }, { id: 'x5' }] })
    const cityRow = createRow({ sourceDeck, size: 4 })
    const oldest = cityRow.cards[0]

    phase('endOfTurn').run({ state, cityRow, log: [], turnManager: createTurnManager({ state }) })

    expect(state.treasury).toBe(7) // budget resets happen in 'draw', not here
    expect(cityRow.cards).not.toContain(oldest)
    expect(cityRow.cards).toHaveLength(4)
    expect(state.disasterTimer.turnsUntilDeadline).toBe(3)
  })

  it('shuffles a random disaster card into the draw pile and resets the timer once the deadline hits, unless headed off', () => {
    const state = createPlayerState()
    state.disasterTimer.turnsUntilDeadline = 1
    const flood = { id: 'flood', type: 'disaster', name: 'Flood' }

    phase('endOfTurn').run({
      state, log: [], turnManager: createTurnManager({ state }), disasterCards: [flood]
    })

    expect(state.deck.drawPile).toContain(flood)
    expect(state.disasterTimer).toMatchObject({ turnsUntilDeadline: 4, strikes: 1 })
  })

  it('escalates: the Nth strike brings N cards, less one per standing Fire Station', () => {
    const state = createPlayerState()
    const flood = { id: 'flood', type: 'disaster', name: 'Flood' }
    const station = { id: 'fire-station', type: 'building', name: 'Fire Station', blocksDisasters: true }
    seedStructure(state, station, { x: 0, y: 0 })
    const ctx = () => ({ state, log: [], turnManager: createTurnManager({ state }), disasterCards: [flood] })

    state.disasterTimer.turnsUntilDeadline = 1
    phase('endOfTurn').run(ctx())
    expect(state.deck.drawPile.filter(c => c === flood)).toHaveLength(0) // strike 1, one station: held off

    state.disasterTimer.turnsUntilDeadline = 1
    phase('endOfTurn').run(ctx())
    expect(state.deck.drawPile.filter(c => c === flood)).toHaveLength(1) // strike 2: one gets through
    expect(state.disasterTimer.strikes).toBe(2)
  })

  it('adds a Crime card when people outnumber jobs', () => {
    const state = createPlayerState()
    const crime = { id: 'crime', type: 'status', name: 'Crime', tags: ['crime'] }
    seedStructure(state, { id: 'house', type: 'building', name: 'House', stats: { population: 2 } }, { x: 0, y: 0 })
    const log = []
    phase('endOfTurn').run({ state, log, turnManager: createTurnManager({ state }), catalog: { crime } })
    expect(state.deck.discardPile).toContain(crime)
    expect(log.join(' ')).toMatch(/Unemployment/)
    seedStructure(state, { id: 'shop', type: 'building', name: 'Shop', stats: { jobs: 2 } }, { x: 1, y: 0 })
    phase('endOfTurn').run({ state, log: [], turnManager: createTurnManager({ state }), catalog: { crime } })
    expect(state.deck.discardPile.filter(c => c === crime)).toHaveLength(1)
  })

  it('counts every goal down and expires the ones at zero when the row has clocks', () => {
    const state = createPlayerState()
    const goalDeck = createDeck({ id: 'goal', cards: [{ id: 'g-next', tier: 1 }] })
    const goalRow = { sourceDeck: goalDeck, size: 2, cards: [{ id: 'g-a', name: 'g-a', tier: 1 }, { id: 'g-b', name: 'g-b', tier: 2 }], timers: [1, 3], timerFor: (c) => 3 + c.tier }
    const log = []
    phase('endOfTurn').run({ state, goalRow, log, turnManager: createTurnManager({ state }) })
    expect(goalRow.cards.map(c => c.id)).toEqual(['g-b', 'g-next'])
    expect(goalRow.timers).toEqual([2, 4])
    expect(log.join(' ')).toMatch(/time ran out: g-a/)
  })

  it('expires the lowest-tier unclaimed goal every 4 turns, backfilling from the source deck', () => {
    const state = createPlayerState()
    const goalDeck = createDeck({ id: 'goal', cards: [] })
    // Built by hand (not via createRow, which would draw from goalDeck
    // immediately on creation) so the deck's draw pile is reserved purely
    // for the post-expiry backfill, not partly consumed just seeding the
    // row's initial 3 cards.
    const goalRow = {
      sourceDeck: goalDeck,
      size: 3,
      cards: [
        { id: 'g-mid', tier: 2 },
        { id: 'g-cheap', tier: 1 },
        { id: 'g-expensive', tier: 3 }
      ]
    }
    goalDeck.drawPile = [{ id: 'g-backfill', tier: 1 }]
    const turnManager = createTurnManager({ state })
    turnManager.turnNumber = 3 // (turnNumber + 1) % 4 === 0 -> this IS the 4th turn

    phase('endOfTurn').run({ state, goalRow, log: [], turnManager })

    // g-cheap (tier 1) is the lowest tier and comes before g-mid does not
    // matter here - it's the ONLY tier-1 card, so it's unambiguously the one expired.
    expect(goalRow.cards.map(card => card.id)).toEqual(expect.arrayContaining(['g-mid', 'g-expensive', 'g-backfill']))
    expect(goalRow.cards.find(card => card.id === 'g-cheap')).toBeUndefined()
    expect(goalRow.cards).toHaveLength(3)
    expect(goalDeck.discardPile.map(card => card.id)).toEqual(['g-cheap'])
  })

  it('leaves the goal row untouched on turns that are not a multiple of 4', () => {
    const state = createPlayerState()
    const goalDeck = createDeck({ id: 'goal', cards: [] })
    const goalRow = createRow({ sourceDeck: goalDeck, size: 3 })
    goalRow.cards = [{ id: 'g1', tier: 1 }, { id: 'g2', tier: 2 }, { id: 'g3', tier: 3 }]
    const turnManager = createTurnManager({ state })
    turnManager.turnNumber = 1

    phase('endOfTurn').run({ state, goalRow, log: [], turnManager })

    expect(goalRow.cards.map(card => card.id)).toEqual(['g1', 'g2', 'g3'])
  })

  it('sets gameStatus to won once population reaches the target', () => {
    const state = createPlayerState()
    buildStructure(state, { id: 'tower', type: 'building', stats: { population: 25 } })

    phase('endOfTurn').run({ state, log: [], turnManager: createTurnManager({ state }), populationTarget: 20 })

    expect(state.gameStatus).toBe('won')
  })

  it('sets gameStatus to lost once the goal deck and row are both fully exhausted', () => {
    const state = createPlayerState()
    const goalDeck = createDeck({ id: 'goal', cards: [] })
    const goalRow = createRow({ sourceDeck: goalDeck, size: 3 }) // empty deck -> empty row

    phase('endOfTurn').run({
      state, goalRow, hasGoals: true, log: [], turnManager: createTurnManager({ state }), populationTarget: 20
    })

    expect(state.gameStatus).toBe('lost')
  })

  it('does not treat an unconfigured (never-populated) goal deck as exhausted', () => {
    const state = createPlayerState()
    const goalDeck = createDeck({ id: 'goal', cards: [] })
    const goalRow = createRow({ sourceDeck: goalDeck, size: 3 })

    // hasGoals omitted, same as a game created with no goalDeckCardIds
    phase('endOfTurn').run({ state, goalRow, log: [], turnManager: createTurnManager({ state }), populationTarget: 20 })

    expect(state.gameStatus).toBe('playing')
  })

  it('does not overturn an already-decided game status', () => {
    const state = createPlayerState()
    state.gameStatus = 'won'
    const goalDeck = createDeck({ id: 'goal', cards: [] })
    const goalRow = createRow({ sourceDeck: goalDeck, size: 3 })

    phase('endOfTurn').run({ state, goalRow, log: [], turnManager: createTurnManager({ state }), populationTarget: 20 })

    expect(state.gameStatus).toBe('won')
  })
})

describe('cleanup phase', () => {
  it('discards the remaining hand', () => {
    const state = createPlayerState()
    state.hand.push(ROAD, ROAD)

    phase('cleanup').run({ state })

    expect(state.hand).toEqual([])
    expect(state.deck.discardPile.map(c => c.id)).toEqual([ROAD.id, ROAD.id])
  })
})
