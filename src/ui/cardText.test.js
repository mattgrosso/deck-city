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
      'Next door: +1 population per Residential, −1 population per Industrial.',
      'When built: +1 Crime card.'
    ])
  })

  it('explains a road, a facility with slots, and an adjacency card', () => {
    expect(rulesFor(starterCards.ROAD, catalog)[0]).toMatch(/up to 2 street segments/)
    expect(rulesFor(facilityCards.POLICE_STATION, catalog)).toEqual([
      'Play a Crime card from your hand into it: 2 slots a turn. Gone for good.'
    ])
    expect(rulesFor(facilityCards.PARK, catalog)).toEqual([
      'Next door: +1 revenue per Residential.'
    ])
  })

  it('states a goal\'s condition, reward, and what it becomes', () => {
    expect(rulesFor(goalCards.GOAL_CITY_BANK, catalog)).toEqual([
      'Covers 3 plots in an L.',
      '+1 revenue, +1 population',
      'Needs 8 budget unspent at once.',
      'Single use: once built, the card is gone.',
      'When claimed: +3 budget, keep up to 10 unspent budget between turns, adopt a policy (choose one of three).'
    ])
  })

  it('never hides an effect it does not know', () => {
    expect(rulesFor({ name: 'X', effects: { onBuild: [{ type: 'summonDragons' }] } })).toEqual(['When built: summonDragons.'])
  })

  it('reads disasters and status cards honestly', () => {
    expect(rulesFor(disasterCards.FLOOD, catalog)).toEqual(['When drawn: lose 3 budget.'])
    expect(rulesFor(starterCards.CRIME, catalog)[0]).toMatch(/Play it into a Police Station/)
  })
})

describe('conditionText', () => {
  it('handles every condition shape in the goal deck', () => {
    expect(conditionText({ type: 'all', conditions: [{ type: 'populationAtLeast', amount: 10 }, { type: 'buildingCountAtLeast', cardId: 'police-station', amount: 1 }] }, catalog))
      .toBe('population 10 or more and 1 Police Station built')
    expect(conditionText({ type: 'statusCountAtMost', tag: 'trash', amount: 0 }, catalog)).toBe('no Trash in your deck')
    expect(conditionText({ type: 'statusTotalAtMost', amount: 3 }, catalog)).toBe('3 or fewer bad cards in your deck')
    expect(conditionText({ type: 'employed' }, catalog)).toBe('a job for everyone')
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
