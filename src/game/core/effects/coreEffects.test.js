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
    expect(state.deck.discardPile).toEqual([CRIME, CRIME])
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
    expect(state.deck.discardPile).toEqual([CLINIC])
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
    expect(state.deck.discardPile).toEqual([ROAD])
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
