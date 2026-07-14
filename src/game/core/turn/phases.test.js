import { describe, it, expect } from 'vitest'
import '../effects/coreEffects'
import { DEFAULT_PHASES } from './phases'
import { createPlayerState, buildStructure } from '../state/playerState'
import { createDeck } from '../piles/deck'
import { createRow } from '../piles/row'
import { buildCardCatalog } from '../cards/cardSchema'
import { CLINIC, CRIME, ROAD } from '../cards/exampleCards'

const catalog = buildCardCatalog([CLINIC, CRIME, ROAD])
const phase = (name) => DEFAULT_PHASES.find(p => p.name === name)

describe('draw phase', () => {
  it('resets slot usage, resolves onTurnStart effects, then draws up to hand size', () => {
    const state = createPlayerState({ startingDeckCards: [ROAD, ROAD, ROAD] })
    const instance = buildStructure(state, CLINIC, { catalog })
    instance.slots.used = 5 // simulate last turn's consumption
    state.deck.discardPile.push(CRIME)

    phase('draw').run({ state, catalog, handSize: 2 })

    // onTurnStart's consumeStatus should have run after the reset, so the
    // instance ends this phase having consumed exactly 1 (not blocked by
    // last turn's stale usage).
    expect(instance.slots.used).toBe(1)
    // CLINIC itself is in the discard pile too — buildStructure() returns
    // the played card there as part of building it — only CRIME is consumed.
    expect(state.deck.discardPile).toEqual([CLINIC])
    expect(state.hand).toHaveLength(2)
  })
})

describe('endOfTurn phase', () => {
  it('tallies revenue, expires the oldest row card, and ticks the disaster timer', () => {
    const state = createPlayerState({ treasury: 0 })
    buildStructure(state, { id: 'shop', type: 'building', stats: { revenue: 3 } })
    const sourceDeck = createDeck({ id: 'city', cards: [{ id: 'x1' }, { id: 'x2' }, { id: 'x3' }, { id: 'x4' }, { id: 'x5' }] })
    const cityRow = createRow({ sourceDeck, size: 4 })
    const oldest = cityRow.cards[0]

    phase('endOfTurn').run({ state, cityRow, log: [] })

    expect(state.treasury).toBe(3)
    expect(cityRow.cards).not.toContain(oldest)
    expect(cityRow.cards).toHaveLength(4)
    expect(state.disasterTimer.turnsUntilDeadline).toBe(3)
  })

  it('invokes onDisasterDeadline and resets the timer once the deadline hits', () => {
    const state = createPlayerState()
    state.disasterTimer.turnsUntilDeadline = 1
    let deadlineHit = false

    phase('endOfTurn').run({ state, onDisasterDeadline: () => { deadlineHit = true } })

    expect(deadlineHit).toBe(true)
    expect(state.disasterTimer).toEqual({ turnsUntilDeadline: 4, headedOff: false })
  })
})

describe('cleanup phase', () => {
  it('discards the remaining hand', () => {
    const state = createPlayerState()
    state.hand.push(ROAD, ROAD)

    phase('cleanup').run({ state })

    expect(state.hand).toEqual([])
    expect(state.deck.discardPile).toEqual([ROAD, ROAD])
  })
})
