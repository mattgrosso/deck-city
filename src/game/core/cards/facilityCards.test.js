import { describe, it, expect } from 'vitest'
import { validateCard, buildCardCatalog } from './cardSchema'
import { FACILITY_CATALOG, CITY_DECK_CARDS, POLICE_STATION, SANITATION_CENTER, CLINIC, FIRE_STATION, PARK } from './facilityCards'

describe('FACILITY_CATALOG', () => {
  it('every card is valid', () => {
    FACILITY_CATALOG.forEach(card => {
      expect(validateCard(card)).toEqual([])
    })
  })

  it('has no duplicate ids', () => {
    const ids = FACILITY_CATALOG.map(card => card.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('each consumer facility targets a distinct status via onTurnStart', () => {
    expect(POLICE_STATION.effects.onTurnStart[0].card).toBe('crime')
    expect(SANITATION_CENTER.effects.onTurnStart[0].card).toBe('trash')
    expect(CLINIC.effects.onTurnStart[0].card).toBe('pollution')
  })

  it('Fire Station heads off the disaster timer onBuild rather than consuming a status', () => {
    expect(FIRE_STATION.effects.onBuild).toEqual([{ type: 'headOffDisaster' }])
    expect(FIRE_STATION.slots).toBeUndefined()
  })

  it('Park grants an adjacency revenue bonus and generates Crime near Residential', () => {
    expect(PARK.adjacency.statBonus).toEqual([{ stat: 'revenue', amount: 1, targetTag: 'residential' }])
    expect(PARK.effects.onTurnStart[0]).toEqual({ type: 'gainStatusPerAdjacent', card: 'crime', targetTag: 'residential' })
  })
})

describe('CITY_DECK_CARDS', () => {
  it('is 2 copies of every facility', () => {
    expect(CITY_DECK_CARDS).toHaveLength(FACILITY_CATALOG.length * 2)
  })

  it('every id resolves against the catalog', () => {
    const catalog = buildCardCatalog(FACILITY_CATALOG)
    CITY_DECK_CARDS.forEach(id => expect(catalog[id]).toBeDefined())
  })
})
