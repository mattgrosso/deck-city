import { describe, it, expect } from 'vitest'
import { createGame, starterCards, facilityCards, buildCardCatalog } from '../index'
import { choosePlacement } from './autoPlace'
import { hasRoadFrontage } from './cityGrid'

const cards = [...starterCards.STARTER_CARD_CATALOG, ...facilityCards.FACILITY_CATALOG]
const catalog = buildCardCatalog(cards)
const start = (ids, extra = {}) => {
  const game = createGame({ cardCatalog: cards, startingDeckCardIds: ids, handSize: ids.length, treasury: 99, ...extra })
  game.actions.advance() // draw -> build
  game.state.treasury = 99
  return game
}

describe('the city places its own buildings', () => {
  it('puts each one on a plot with a street beside it, laying a street when it must', () => {
    const game = start(Array(8).fill('residential'))
    for (let i = 0; i < 8; i++) game.actions.playCard('residential')
    const s = game.state
    expect(s.builtStructures).toHaveLength(8)
    for (const b of s.builtStructures) expect(hasRoadFrontage(s.cityGrid, b.position.x, b.position.y)).toBe(true)
    expect(s.cityGrid.roads.size).toBeGreaterThan(1) // the starting street alone fronts only four plots
  })

  it('keeps a kind together: a second home goes next to the first', () => {
    const game = start(['residential', 'residential'])
    const a = game.actions.playCard('residential')
    const b = game.actions.playCard('residential')
    expect(Math.abs(a.position.x - b.position.x) + Math.abs(a.position.y - b.position.y)).toBe(1)
  })

  it('upgrades a facility you already have instead of building another', () => {
    const game = start(['police-station', 'police-station'])
    game.actions.playCard('police-station')
    const room = game.state.builtStructures[0].slots.capacity
    game.actions.playCard('police-station')
    expect(game.state.builtStructures).toHaveLength(1)
    expect(game.state.builtStructures[0].slots.capacity).toBe(room * 2)
  })

  it('says null when nothing fits', () => {
    const game = start(['residential'])
    const s = game.state
    s.cityGrid.limits = { x0: 0, y0: 0, x1: 0, y1: 0 }
    expect(choosePlacement(s, catalog.residential)).toBeNull()
  })
})
