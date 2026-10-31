import { describe, it, expect } from 'vitest'
import './coreEffects'
import { resolveEffect, resolveTrigger } from './effectRegistry'
import { createPlayerState, buildStructure } from '../state/playerState'
import { buildCardCatalog } from '../cards/cardSchema'
import { ROAD, CRIME, RESIDENTIAL, CLINIC } from '../cards/exampleCards'

const catalog = buildCardCatalog([ROAD, CRIME, RESIDENTIAL, CLINIC])

describe('gainTreasury / spendTreasury', () => {
  it('adjusts treasury', () => {
    const state = createPlayerState({ treasury: 10 })
    resolveEffect({ type: 'gainTreasury', amount: 5 }, { state })
    expect(state.treasury).toBe(15)
    resolveEffect({ type: 'spendTreasury', amount: 3 }, { state })
    expect(state.treasury).toBe(12)
  })
})

describe('gainStatus / consumeStatus', () => {
  it('gainStatus looks the card up in the catalog and adds it to discard', () => {
    const state = createPlayerState()
    resolveEffect({ type: 'gainStatus', card: 'crime', amount: 2 }, { state, catalog })
    expect(state.deck.discardPile.map(c => c.id)).toEqual([CRIME.id, CRIME.id])
  })

  it('consumeStatus resolves buildingId "self" to context.instanceId', () => {
    const state = createPlayerState()
    const instance = buildStructure(state, CLINIC, { catalog })
    state.deck.discardPile.push(CRIME)

    resolveEffect(
      { type: 'consumeStatus', card: 'crime', amount: 1, requiresSlot: true, buildingId: 'self' },
      { state, catalog, instanceId: instance.instanceId }
    )

    // CLINIC itself is in the discard pile too, from buildStructure()
    // returning the played card there; only CRIME is consumed.
    expect(state.deck.discardPile.map(c => c.id)).toEqual([CLINIC.id])
    expect(instance.slots.used).toBe(1)
  })
})

describe('building Residential end-to-end via onBuild', () => {
  it('produces a Crime status card through resolveTrigger', () => {
    const state = createPlayerState()
    buildStructure(state, RESIDENTIAL, { catalog })
    expect(state.deck.discardPile).toContainEqual(CRIME)
  })
})

describe('drawCards / discardCards', () => {
  it('drawCards moves cards from the deck into hand', () => {
    const state = createPlayerState({ startingDeckCards: [ROAD] })
    resolveEffect({ type: 'drawCards', amount: 1 }, { state })
    expect(state.hand).toEqual([ROAD])
  })

  it('discardCards moves named cards from hand to discard', () => {
    const state = createPlayerState()
    state.hand.push(ROAD)
    resolveEffect({ type: 'discardCards' }, { state, cardIds: ['road'] })
    expect(state.hand).toEqual([])
    expect(state.deck.discardPile.map(c => c.id)).toEqual([ROAD.id])
  })
})

describe('expandSlots effect', () => {
  it('expands a named instance', () => {
    const state = createPlayerState()
    const instance = buildStructure(state, CLINIC, { catalog })
    resolveEffect({ type: 'expandSlots', buildingId: instance.instanceId, amount: 1 }, { state })
    expect(instance.slots.capacity).toBe(6)
  })
})

describe('resolveTrigger with the real registry', () => {
  it('is unaffected by unrelated triggers', () => {
    expect(resolveTrigger(ROAD, 'onBuild', {})).toEqual([])
  })
})

describe('gainStatusPerAdjacent', () => {
  const RESIDENTIAL_TAGGED = { id: 'residential-tagged', type: 'building', tags: ['residential'], stats: {} }

  it('grants one status card per adjacent instance matching the target tag', () => {
    const state = createPlayerState()
    const park = buildStructure(state, { id: 'park', type: 'building', stats: {} }, { position: { x: 2, y: 2 } })
    buildStructure(state, RESIDENTIAL_TAGGED, { position: { x: 2, y: 1 } })
    buildStructure(state, RESIDENTIAL_TAGGED, { position: { x: 3, y: 2 } })
    buildStructure(state, { id: 'commercial', type: 'building', tags: ['commercial'], stats: {} }, { position: { x: 1, y: 2 } })

    const count = resolveEffect(
      { type: 'gainStatusPerAdjacent', card: 'crime', targetTag: 'residential' },
      { state, catalog, instanceId: park.instanceId }
    )

    expect(count).toBe(2)
    expect(state.deck.discardPile.filter(card => card.id === 'crime')).toHaveLength(2)
  })

  it('grants nothing when no neighbor matches', () => {
    const state = createPlayerState()
    const park = buildStructure(state, { id: 'park', type: 'building', stats: {} }, { position: { x: 2, y: 2 } })

    const count = resolveEffect(
      { type: 'gainStatusPerAdjacent', card: 'crime', targetTag: 'residential' },
      { state, catalog, instanceId: park.instanceId }
    )

    expect(count).toBe(0)
    expect(state.deck.discardPile.filter(card => card.id === 'crime')).toHaveLength(0)
  })
})

describe('headOffDisaster effect', () => {
  it('freezes the disaster timer', () => {
    const state = createPlayerState()
    resolveEffect({ type: 'headOffDisaster' }, { state })
    expect(state.disasterTimer.headedOff).toBe(true)
  })
})

describe('raiseTreasuryRolloverCap effect', () => {
  it('raises the cap', () => {
    const state = createPlayerState()
    resolveEffect({ type: 'raiseTreasuryRolloverCap', amount: 10 }, { state })
    expect(state.treasuryRolloverCap).toBe(10)
  })
})
