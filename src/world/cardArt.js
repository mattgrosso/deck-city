// What each card's PICTURE is: a little scene of Kenney parts, rendered once
// by scripts/render-card-art.mjs (through dev-art.html) into public/art/
// <card id>.png, and shown on the card face. Buildings use the same recipe
// the board builds them from (cityLayout.js), so the card shows exactly
// what you'll get; the rest are small dioramas of what the card means.

import { RECIPES } from './cityLayout'
import { lookFor } from './looks'
import { CITY_CARDS, TOKEN_CATALOG } from '@/game/core/cards/cityCards'

const scene = (parts, extra = {}) => ({ parts, ...extra })
const part = (model, o = {}) => ({ model, scale: 1, dx: 0, dz: 0, yaw: 0, ...o })

export const CARD_ART = {
  // `street` parts are built from src/world/streets.js, the same geometry the board uses.
  road: scene([{ street: 'edge', axis: 'x', length: 2.2, dx: 0, dz: 0 }, { street: 'node', arms: ['e'], dx: -1.34, dz: 0 }, { street: 'node', arms: ['w'], dx: 1.34, dz: 0 }, part('roads/light-curved', { dx: 0.4, dz: 0.42, scale: 1.0 }), part('suburban/tree-small', { dx: -0.7, dz: -0.5, scale: 1.1 })], { ground: 'field', zoom: 0.95 }),
  residential: scene(RECIPES.residential.variants[0].parts.map(p => part(p.model, { scale: 1 }))),
  commercial: scene(RECIPES.commercial.variants[0].parts.map(p => part(p.model, { scale: 1 }))),
  industrial: scene(RECIPES.industrial.variants[0].parts.map(p => part(p.model, { scale: 1 }))),
  'police-station': scene(RECIPES['police-station'].variants[0].parts.map(p => part(p.model, { ...p, scale: p.scale / 0.82 }))),
  'fire-station': scene(RECIPES['fire-station'].variants[0].parts.map(p => part(p.model, { ...p, scale: p.scale / 0.56 }))),
  clinic: scene(RECIPES.clinic.variants[0].parts.map(p => part(p.model, { ...p, scale: p.scale / 0.46 }))),
  'sanitation-center': scene(RECIPES['sanitation-center'].variants[0].parts.map(p => part(p.model, { ...p, scale: p.scale / 0.62 }))),
  park: scene(RECIPES.park.variants[0].parts.map(p => part(p.model, { ...p, scale: p.scale * 1.3, dx: p.dx * 1.3, dz: p.dz * 1.3 })), { ground: 'park' }),
  'civic-recycle': scene([part('roads/construction-barrier', { scale: 2.2, dx: -0.3 }), part('roads/construction-cone', { scale: 2.2, dx: 0.35, dz: 0.3 }), part('roads/construction-cone', { scale: 2.2, dx: 0.55, dz: -0.1 }), part('roads/road-sign-warning', { scale: 1.6, dx: 0.1, dz: -0.5 })]),
  'trade-fair': scene([part('commercial/detail-parasol-a', { scale: 1.8, dx: -0.45, dz: 0.1 }), part('commercial/detail-parasol-b', { scale: 1.8, dx: 0.35, dz: -0.3 }), part('commercial/detail-awning-wide', { scale: 1.4, dx: 0.1, dz: 0.5 }), part('suburban/planter', { scale: 1.4, dx: 0.6, dz: 0.45 })], { ground: 'plaza' }),
  crime: scene([part('roads/road-sign-stop', { scale: 2.0, dx: -0.35 }), part('roads/light-curved', { scale: 1.6, dx: 0.4, dz: 0.2 }), part('roads/dumpster', { scale: 1.8, dx: 0.3, dz: -0.4, yaw: 0.6 })], { mood: 'dark' }),
  trash: scene([part('roads/dumpster', { scale: 2.2, dx: -0.3, yaw: 0.3 }), part('roads/dumpster', { scale: 2.2, dx: 0.35, dz: 0.2, yaw: -0.4 }), part('roads/dumpster', { scale: 2.0, dx: 0.05, dz: -0.5, yaw: 1.2 })], { mood: 'dark' }),
  pollution: scene([part('industrial/chimney-large', { scale: 0.9, dx: -0.2 }), part('industrial/chimney-medium', { scale: 0.9, dx: 0.5, dz: 0.3 }), part('industrial/detail-tank', { scale: 1.2, dx: 0.4, dz: -0.5 })], { mood: 'dark' }),
  flood: scene([part('suburban/building-type-a', { scale: 1.0 }), part('roads/tile-low', { scale: 2.6, tint: 0x3b7ad9, dy: 0.28 })], { mood: 'dark' }),
  blackout: scene([part('roads/electricity-pole', { scale: 2.0, dx: -0.3 }), part('roads/light-curved', { scale: 1.8, dx: 0.5, dz: 0.3 }), part('suburban/building-type-h', { scale: 0.8, dx: 0.1, dz: -0.7, tint: 0x6b7280 })], { mood: 'dark' }),
  'goal-grand-opening': scene([part('commercial/building-f', { scale: 0.95 }), part('commercial/detail-parasol-a', { scale: 1.6, dx: 0.6, dz: 0.5 })], { ground: 'plaza' }),
  'goal-full-employment': scene([part('commercial/building-j', { scale: 0.75 })], { ground: 'plaza' }),
  'goal-clean-streets': scene([{ street: 'edge', axis: 'x', length: 2.0, dx: 0, dz: -0.1 }, part('suburban/planter', { scale: 1.5, dx: -0.5, dz: 0.5 }), part('suburban/tree-small', { scale: 1.5, dx: 0.5, dz: 0.5 }), part('roads/light-square', { scale: 1.2, dx: 0.1, dz: -0.6 })], { ground: 'field' }),
  'goal-park-district': scene([part('suburban/tree-large', { scale: 1.6, dx: -0.5 }), part('suburban/building-type-c', { scale: 0.85, dx: 0.45, dz: 0.1 }), part('suburban/tree-small', { scale: 1.5, dx: -0.2, dz: 0.6 })], { ground: 'park' }),
  'goal-neighborhood-watch': scene([part('commercial/building-c', { scale: 0.95, tint: 0x6f8fe8 }), part('roads/light-square', { scale: 1.4, dx: 0.6, dz: 0.5 })], { ground: 'plaza' }),
  'goal-city-bank': scene([part('commercial/building-l', { scale: 0.62, tint: 0xffe6b0 })], { ground: 'plaza' }),
  'goal-housing-row': scene([part('suburban/building-type-k', { scale: 0.8, dx: -0.75 }), part('suburban/building-type-l', { scale: 0.8 }), part('suburban/building-type-r', { scale: 0.8, dx: 0.75 })], { ground: 'none', zoom: 0.85 })
}

// The rest of the city catalogue (cityCards.js): a building's card shows its
// board look; civic cards and tokens get a small scene of props; the newer
// goals get one each.
const CIVIC_SCENES = [
  [part('roads/construction-barrier', { scale: 2.2, dx: -0.3 }), part('roads/construction-cone', { scale: 2.2, dx: 0.35, dz: 0.3 }), part('roads/road-sign-warning', { scale: 1.6, dx: 0.1, dz: -0.5 })],
  [part('commercial/detail-awning-wide', { scale: 1.6 }), part('commercial/detail-parasol-a', { scale: 1.8, dx: -0.5, dz: 0.4 }), part('suburban/planter', { scale: 1.6, dx: 0.5, dz: 0.4 })],
  [part('roads/light-square', { scale: 1.6, dx: -0.3 }), part('suburban/planter', { scale: 1.8, dx: 0.3, dz: 0.2 }), part('roads/road-sign-empty', { scale: 1.6, dx: 0.1, dz: -0.4 })],
  [part('commercial/building-l', { scale: 0.45, tint: 0xfff1c9 }), part('suburban/planter', { scale: 1.6, dx: 0.5, dz: 0.5 })]
]
const SPECIAL = {
  boulevard: scene([{ street: 'edge', axis: 'x', length: 2.4 }, part('suburban/tree-small', { scale: 1.4, dx: -0.6, dz: -0.45 }), part('suburban/tree-small', { scale: 1.4, dx: 0, dz: -0.45 }), part('suburban/tree-small', { scale: 1.4, dx: 0.6, dz: -0.45 }), part('roads/light-curved', { scale: 1.2, dx: 0.3, dz: 0.45 })], { ground: 'field' }),
  highway: scene([{ street: 'edge', axis: 'x', length: 2.6, dz: -0.25 }, { street: 'edge', axis: 'x', length: 2.6, dz: 0.25 }, part('roads/sign-highway', { scale: 1.1, dx: 0.5, dz: 0 })], { ground: 'field' }),
  tourist: scene([part('commercial/detail-parasol-a', { scale: 2, dx: -0.3 }), part('commercial/detail-parasol-b', { scale: 2, dx: 0.35, dz: 0.2 }), part('suburban/planter', { scale: 1.6, dx: 0.1, dz: -0.5 })], { ground: 'plaza' }),
  commuter: scene([part('roads/traffic-light', { scale: 2, dx: -0.3 }), { street: 'edge', axis: 'x', length: 2.0, dz: 0.3 }, part('roads/light-curved', { scale: 1.4, dx: 0.5, dz: -0.3 })], { ground: 'field' }),
  volunteer: scene([part('roads/dumpster', { scale: 1.8, dx: -0.3 }), part('suburban/planter', { scale: 1.6, dx: 0.35, dz: 0.2 }), part('suburban/tree-small', { scale: 1.5, dx: 0.1, dz: -0.45 })], { ground: 'park' }),
  investor: scene([part('commercial/building-skyscraper-b', { scale: 0.3, tint: 0xfff1c9 })], { ground: 'plaza' }),
  debt: scene([part('commercial/building-l', { scale: 0.5, tint: 0x9aa0b0 }), part('roads/construction-barrier', { scale: 2, dx: 0.5, dz: 0.4 })], { mood: 'dark' }),
  'goal-green-city': scene([part('suburban/tree-large', { scale: 1.6, dx: -0.4 }), part('suburban/tree-large', { scale: 1.4, dx: 0.4, dz: -0.2 }), part('suburban/tree-small', { scale: 1.5, dx: 0, dz: 0.45 })], { ground: 'park' }),
  'goal-commuter-town': scene([{ street: 'edge', axis: 'x', length: 2.2 }, part('roads/traffic-light', { scale: 1.6, dx: -0.4, dz: -0.4 }), part('commercial/building-k', { scale: 0.4, dx: 0.4, dz: -0.6, tint: 0xf1dfc0 })], { ground: 'field' }),
  'goal-industrial-heartland': scene([part('industrial/building-l', { scale: 0.5 }), part('industrial/chimney-large', { scale: 0.6, dx: 0.6, dz: -0.4 })], { ground: 'built' }),
  'goal-school-district': scene([part('commercial/building-c', { scale: 0.9, tint: 0xffd2b8 }), part('suburban/tree-small', { scale: 1.5, dx: 0.6, dz: 0.4 })], { ground: 'plaza' }),
  'goal-tourist-trap': scene([part('commercial/building-skyscraper-d', { scale: 0.35, tint: 0xffe6b0 }), part('commercial/detail-parasol-a', { scale: 1.6, dx: 0.6, dz: 0.4 })], { ground: 'plaza' }),
  'goal-full-service': scene([part('commercial/building-b', { scale: 0.8, tint: 0xbfd0ff }), part('roads/light-square', { scale: 1.2, dx: 0.5, dz: 0.5 })], { ground: 'plaza' })
}
const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
for (const card of [...CITY_CARDS, ...TOKEN_CATALOG]) {
  if (CARD_ART[card.id]) continue
  if (SPECIAL[card.id]) { CARD_ART[card.id] = SPECIAL[card.id]; continue }
  if (card.type === 'building') {
    const look = lookFor(card)
    CARD_ART[card.id] = scene(look.parts.map(p => ({ ...p })), { ground: look.ground === 'park' ? 'park' : look.ground === 'plaza' ? 'plaza' : 'built' })
  } else {
    CARD_ART[card.id] = scene(CIVIC_SCENES[hash(card.id) % CIVIC_SCENES.length])
  }
}
for (const [id, sc] of Object.entries(SPECIAL)) if (!CARD_ART[id]) CARD_ART[id] = sc

/** Card ids that have a rendered picture. */
export const ART_IDS = Object.keys(CARD_ART)
