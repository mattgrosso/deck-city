import { describe, it, expect } from 'vitest'
import { rulesFor, conditionText, familyOf, keywordsFor } from './cardText'
import { starterCards, facilityCards, goalCards, disasterCards, buildCardCatalog } from '@/game/core'

const catalog = buildCardCatalog([
  ...starterCards.STARTER_CARD_CATALOG, ...facilityCards.FACILITY_CATALOG,
  ...goalCards.GOAL_CATALOG, ...disasterCards.DISASTER_CATALOG
])

describe('rulesFor', () => {
  it('says what a zone gives and what it costs you', () => {
    expect(rulesFor(starterCards.RESIDENTIAL, catalog)).toEqual([
      '+2 population, +1 revenue',
      'When built: add 1 Crime to your deck.'
    ])
  })

  it('explains a road, a facility with slots, and an adjacency card', () => {
    expect(rulesFor(starterCards.ROAD, catalog)[0]).toMatch(/Paves the four edges/)
    expect(rulesFor(facilityCards.POLICE_STATION, catalog)).toEqual([
      '2 slots, expandable',
      'Each turn: remove Crime from your deck, one per free slot.'
    ])
    expect(rulesFor(facilityCards.PARK, catalog)).toEqual([
      '+1 revenue to each neighbouring Residential',
      'Each turn: add 1 Crime per neighbouring Residential.'
    ])
  })

  it('states a goal\'s condition, reward, and what it becomes', () => {
    expect(rulesFor(goalCards.GOAL_CITY_BANK, catalog)).toEqual([
      '+1 revenue, +1 population',
      'Needs 8 budget unspent at once.',
      'When claimed: keep up to 10 unspent budget between turns.',
      'Claimed, it becomes a free Monument you can build anywhere.'
    ])
  })

  it('never hides an effect it does not know', () => {
    expect(rulesFor({ name: 'X', effects: { onBuild: [{ type: 'summonDragons' }] } })).toEqual(['When built: summonDragons.'])
  })

  it('reads disasters and status cards honestly', () => {
    expect(rulesFor(disasterCards.FLOOD, catalog)).toEqual(['When drawn: lose 3 budget.'])
    expect(rulesFor(starterCards.CRIME, catalog)).toEqual(['Does nothing. Takes up room in your hand.'])
  })
})

describe('conditionText', () => {
  it('handles every condition shape in the goal deck', () => {
    expect(conditionText({ type: 'all', conditions: [{ type: 'populationAtLeast', amount: 10 }, { type: 'buildingCountAtLeast', cardId: 'police-station', amount: 1 }] }, catalog))
      .toBe('population 10 or more and 1 Police Station built')
    expect(conditionText({ type: 'statusCountAtMost', tag: 'trash', amount: 0 }, catalog)).toBe('no Trash in your deck')
    expect(conditionText({ type: 'adjacentChain', tag: 'residential', length: 3 }, catalog)).toBe('3 Residential in a row')
  })
})

describe('familyOf and keywordsFor', () => {
  it('colours by zone, then facility, with status/goal/disaster their own', () => {
    expect(familyOf(starterCards.ROAD)).toBe('road')
    expect(familyOf(starterCards.INDUSTRIAL)).toBe('industrial')
    expect(familyOf(facilityCards.CLINIC)).toBe('facility')
    expect(familyOf(goalCards.GOAL_PARK_DISTRICT)).toBe('goal')
    expect(familyOf(disasterCards.BLACKOUT)).toBe('disaster')
    expect(familyOf(starterCards.CIVIC_RECYCLE)).toBe('civic')
  })

  it('lists the keywords a card touches', () => {
    expect(keywordsFor(facilityCards.POLICE_STATION, catalog).map(([k]) => k)).toEqual(['slot', 'status'])
    expect(keywordsFor(starterCards.ROAD, catalog).map(([k]) => k)).toEqual(['road'])
  })
})
