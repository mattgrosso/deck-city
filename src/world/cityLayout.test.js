import { describe, it, expect } from 'vitest'
import { layoutCity, recipeFor, cellCentre, cornerPoint, allModels, treesFor, PITCH, RECIPES } from './cityLayout'
import { createCityGrid, placeInstance, addRoadsAroundCell, starterCards, facilityCards, goalCards } from '@/game/core'

const grid = () => createCityGrid({ width: 6, height: 4 })

describe('layoutCity', () => {
  it('lays a lot per cell, centred on the origin', () => {
    const { lots } = layoutCity(grid(), [])
    expect(lots.length).toBe(24)
    const xs = lots.map(l => l.wx)
    expect(Math.min(...xs)).toBeCloseTo(-Math.max(...xs))
    expect(cellCentre(grid(), 0, 0).x).toBeCloseTo(-2.5 * PITCH)
  })

  it('turns a roaded cell into four edges and four corner nodes with two arms each', () => {
    const g = grid()
    addRoadsAroundCell(g, 2, 1)
    const { roadEdges, roadNodes } = layoutCity(g, [])
    expect(roadEdges.length).toBe(4)
    expect(roadEdges.filter(e => e.axis === 'x').length).toBe(2)
    expect(roadNodes.length).toBe(4)
    roadNodes.forEach(n => expect(n.arms.length).toBe(2))
  })

  it('shares an edge between neighbours and gives the shared corners three arms', () => {
    const g = grid()
    addRoadsAroundCell(g, 2, 1)
    addRoadsAroundCell(g, 3, 1)
    const { roadEdges, roadNodes } = layoutCity(g, [])
    expect(roadEdges.length).toBe(7)
    expect(roadNodes.filter(n => n.arms.length === 3).length).toBe(2)
    expect(roadNodes.filter(n => n.arms.length === 2).length).toBe(4)
    expect(new Set(roadEdges.map(r => r.id)).size).toBe(7)
  })

  it('puts a house on a residential lot and varies it by instance', () => {
    const g = grid()
    const a = { instanceId: 'residential#0', card: starterCards.RESIDENTIAL, position: { x: 1, y: 1 } }
    const b = { instanceId: 'residential#1', card: starterCards.RESIDENTIAL, position: { x: 2, y: 1 } }
    placeInstance(g, 1, 1, a.instanceId)
    placeInstance(g, 2, 1, b.instanceId)
    const { placements, lots } = layoutCity(g, [a, b])
    const houses = placements.filter(p => p.kind === 'residential')
    expect(houses.length).toBe(2)
    expect(houses[0].model).not.toBe(houses[1].model)
    expect(houses[0].model).toMatch(/^suburban\//)
    expect(lots.find(l => l.x === 1 && l.y === 1).ground).toBe('built')
  })

  it('knows every card: facilities by id, goals as monuments, parks as green', () => {
    expect(recipeFor(facilityCards.POLICE_STATION).key).toBe('police-station')
    expect(recipeFor(goalCards.GOAL_CITY_BANK).key).toBe('monument')
    expect(recipeFor(facilityCards.PARK).ground).toBe('park')
    expect(recipeFor(starterCards.INDUSTRIAL).parts[0].model).toMatch(/^industrial\//)
  })

  it('corner (0,0) is half a pitch up and left of cell (0,0)', () => {
    const c = cellCentre(grid(), 0, 0)
    const k = cornerPoint(grid(), 0, 0)
    expect(k.x).toBeCloseTo(c.x - PITCH / 2)
    expect(k.z).toBeCloseTo(c.z - PITCH / 2)
  })

  it('scatters the same trees on the same empty cell every time, and none once built', () => {
    expect(treesFor(2, 1)).toEqual(treesFor(2, 1))
    const all = []
    for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) all.push(...treesFor(x, y))
    expect(all.length).toBeGreaterThan(4)
    const g = grid()
    const a = { instanceId: 'residential#0', card: starterCards.RESIDENTIAL, position: { x: 2, y: 1 } }
    placeInstance(g, 2, 1, a.instanceId)
    const { placements } = layoutCity(g, [a])
    expect(placements.some(p => p.id.startsWith('tree:2,1'))).toBe(false)
  })

  it('lists every model the recipes use so the world can preload', () => {
    const models = allModels()
    expect(models).toContain('suburban/tree-small')
    Object.values(RECIPES).forEach(r => r.variants.forEach(v => v.parts.forEach(p => expect(models).toContain(p.model))))
  })
})
