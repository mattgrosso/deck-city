import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { CARD_ART, ART_IDS } from './cardArt'
import { starterCards, facilityCards, goalCards, disasterCards } from '@/game/core'

describe('card art', () => {
  it('covers every card in the game', () => {
    const all = [...starterCards.STARTER_CARD_CATALOG, ...facilityCards.FACILITY_CATALOG, ...goalCards.GOAL_CATALOG, ...disasterCards.DISASTER_CATALOG]
    all.forEach(card => expect(ART_IDS, card.id).toContain(card.id))
  })

  it('has a rendered picture on disk for every scene (scripts/render-card-art.mjs)', () => {
    ART_IDS.forEach(id => expect(existsSync(join(process.cwd(), 'public/art', `${id}.png`)), id).toBe(true))
  })

  it('only asks for parts the kits have', () => {
    Object.values(CARD_ART).forEach(scene => scene.parts.forEach(p => expect(p.model).toMatch(/^(suburban|commercial|industrial|roads)\//)))
  })
})
