// How every building LOOKS on the board: a few Kenney parts per card id.
// Hand-picked for the ones that should be recognisable (an airport, a water
// tower, a stadium); the rest are drawn from a pool by family and tier,
// chosen by the card id's hash so a card always looks the same and two
// cards of a family rarely match. Scales come from each model's measured
// footprint (footprints.json, from dev-models.html's __measureList) so a
// building fits its plot and taller tiers stand taller.

import FOOTPRINTS from './footprints.json'
import { SOURCES, TOWERS, WHOLE, COLOURWAYS, generatorModels } from './buildgen'

const HEIGHT_CAP = { 1: 1.0, 2: 1.6, 3: 2.8 }
const FIT = 0.8 // of a plot's width

const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
const pick = (list, key) => list[hash(key) % list.length]

/** The scale that fits a model into a plot under a tier's height cap. */
export function fitScale (model, tier = 1, fit = FIT) {
  const f = FOOTPRINTS[model]
  if (!f) return 0.6
  const [w, h, d] = f
  return Math.round(Math.min(fit / Math.max(w, d), (HEIGHT_CAP[tier] ?? 1) / h) * 100) / 100
}

const part = (model, o = {}) => ({ model, scale: o.scale ?? fitScale(model, o.tier ?? 1, o.fit), dx: 0, dz: 0, yaw: 0, ...o })
const prop = (model, dx, dz, scale = 1, extra = {}) => ({ model, scale, dx, dz, yaw: 0, ...extra })

const POOLS = {
  residential: {
    1: 'abcdefghijklmnopqrstu'.split('').map(c => `suburban/building-type-${c}`),
    2: ['commercial/building-a', 'commercial/building-b', 'commercial/building-c', 'commercial/building-d', 'commercial/building-h', 'commercial/building-f', 'commercial/building-g'],
    3: ['commercial/building-skyscraper-a', 'commercial/building-skyscraper-b', 'commercial/building-skyscraper-c', 'commercial/building-skyscraper-e', 'commercial/building-m', 'commercial/building-l']
  },
  commercial: {
    1: ['commercial/building-c', 'commercial/building-e', 'commercial/building-k', 'commercial/building-h', 'commercial/low-detail-building-wide-a', 'commercial/low-detail-building-wide-b'],
    2: ['commercial/building-f', 'commercial/building-g', 'commercial/building-i', 'commercial/building-j', 'commercial/building-l', 'commercial/building-n'],
    3: ['commercial/building-m', 'commercial/building-n', 'commercial/building-skyscraper-b', 'commercial/building-skyscraper-c', 'commercial/building-skyscraper-d', 'commercial/building-skyscraper-e']
  },
  industrial: {
    1: ['industrial/building-d', 'industrial/building-g', 'industrial/building-h', 'industrial/building-i', 'industrial/building-j', 'industrial/building-k', 'industrial/building-o', 'industrial/building-p'],
    2: ['industrial/building-a', 'industrial/building-b', 'industrial/building-c', 'industrial/building-e', 'industrial/building-m', 'industrial/building-q', 'industrial/building-r', 'industrial/building-s', 'industrial/building-t'],
    3: ['industrial/building-f', 'industrial/building-l', 'industrial/building-c', 'industrial/building-r']
  },
  facility: { 1: ['commercial/building-c', 'commercial/building-e', 'commercial/building-k', 'commercial/building-a'], 2: ['commercial/building-b', 'commercial/building-i', 'commercial/building-j', 'commercial/building-l'], 3: ['commercial/building-n', 'commercial/building-m', 'commercial/building-j'] },
  leisure: { 1: ['commercial/building-e', 'commercial/building-k', 'commercial/building-c'], 2: ['commercial/building-j', 'commercial/building-i', 'commercial/building-n'], 3: ['commercial/building-n', 'commercial/building-skyscraper-d'] },
  transit: { 1: ['commercial/low-detail-building-wide-a'], 2: ['commercial/building-k', 'industrial/building-p'], 3: ['commercial/building-n', 'industrial/building-q'] }
}

const TINTS = {
  residential: [null, null, 0xfff1dc, 0xe7f0ff],
  commercial: [null, 0xffe7cf, 0xdcebff, 0xfff4c8, 0xe9ffe9],
  industrial: [null],
  facility: [0xdfe6ff, 0xfff0f0, 0xffe2cc],
  leisure: [0xffd3e8, 0xe6d6ff, 0xffe3c2],
  transit: [0xd9dee8, 0xe4ecff],
  landmark: [0xfff0c8]
}
const SERVICE_TINT = { safety: 0xbfd0ff, health: 0xffffff, education: 0xffd2b8, utility: null, finance: 0xfff1c9 }

/** Distinctive looks, by card id. */
const OVERRIDES = {
  airport: () => ({ parts: [part('industrial/building-q', { tier: 3, tint: 0xe4ecff }), prop('roads/sign-highway', 0.42, 0.3, 0.6)], ground: 'built' }),
  'train-station': () => ({ parts: [part('commercial/building-k', { tier: 2, tint: 0xf1dfc0 }), prop('roads/traffic-light', 0.42, 0.42, 0.9)] }),
  'metro-hub': () => ({ parts: [part('commercial/building-skyscraper-c', { tier: 3, tint: 0xd4ddff })] }),
  'bus-stop': () => ({ parts: [prop('roads/light-square', -0.2, 0.2, 1.1), prop('roads/road-sign-empty', 0.2, -0.1, 1.2), prop('suburban/planter', 0.25, 0.3, 1.0)], ground: 'built' }),
  'parking-garage': () => ({ parts: [part('commercial/low-detail-building-wide-a', { tint: 0xd0d4dc })] }),
  'bike-share': () => ({ parts: [prop('suburban/planter', -0.25, 0.1, 1.2), prop('suburban/planter', 0.25, 0.1, 1.2), prop('roads/light-curved', 0, -0.25, 1.0)], ground: 'built' }),
  'tram-depot': () => ({ parts: [part('industrial/building-p', { tier: 2, tint: 0xd8e6ff })] }),
  'ferry-terminal': () => ({ parts: [part('commercial/building-e', { tier: 2, tint: 0xcfe8ff }), prop('commercial/detail-parasol-a', 0.38, 0.35, 0.9)] }),
  'water-tower': () => ({ parts: [part('industrial/water-tower', { tier: 2 })] }),
  landfill: () => ({ parts: [part('industrial/detail-tank-large', { fit: 0.6 }), prop('industrial/shipping-container-a', 0.3, 0.3, 0.8, { yaw: 1.2 })] }),
  junkyard: () => ({ parts: [prop('industrial/shipping-container-a', -0.2, -0.1, 0.9, { yaw: 0.3 }), prop('industrial/shipping-container-b', 0.2, 0.15, 0.9, { yaw: -0.4 }), prop('roads/dumpster', 0.25, -0.3, 1.2), prop('industrial/shipping-container-c', -0.15, 0.3, 0.9, { yaw: 1.4 })] }),
  'solar-farm': () => ({ parts: [prop('industrial/solar-panel-landscape-group', 0, -0.2, 0.55), prop('industrial/solar-panel-landscape-group', 0, 0.22, 0.55)], ground: 'park' }),
  'coal-plant': () => ({ parts: [part('industrial/building-k', { fit: 0.6 }), prop('industrial/chimney-large', 0.28, -0.28, 0.45)] }),
  'chemical-plant': () => ({ parts: [part('industrial/building-c', { tier: 2 }), prop('industrial/detail-tank', 0.3, 0.35, 0.7)] }),
  'steel-mill': () => ({ parts: [part('industrial/building-f', { tier: 2 }), prop('industrial/chimney-medium', -0.35, 0.3, 0.6)] }),
  stadium: () => ({ parts: [part('commercial/building-n', { tier: 3, tint: 0xffdca8 })], ground: 'plaza' }),
  cathedral: () => ({ parts: [part('commercial/building-skyscraper-a', { tier: 3, tint: 0xf2ead8 })], ground: 'plaza' }),
  'observation-tower': () => ({ parts: [part('commercial/building-skyscraper-d', { tier: 3, tint: 0xffe6b0, fit: 0.55 })], ground: 'plaza' }),
  'monument-plaza': () => ({ parts: [part('commercial/building-skyscraper-a', { scale: 0.25, tint: 0xffd166 }), prop('suburban/planter', -0.3, 0.3, 1), prop('suburban/planter', 0.3, 0.3, 1), prop('suburban/tree-small', -0.3, -0.3, 1), prop('suburban/tree-small', 0.3, -0.3, 1)], ground: 'plaza' }),
  'stock-exchange': () => ({ parts: [part('commercial/building-l', { tier: 3, tint: 0xfff1c9 })], ground: 'plaza' }),
  'corporate-hq': () => ({ parts: [part('commercial/building-skyscraper-e', { tier: 3, tint: 0xc9e2ff })] }),
  arcology: () => ({ parts: [part('commercial/building-skyscraper-b', { tier: 3, tint: 0xd9f2e6 }), prop('suburban/tree-small', 0.38, 0.38, 0.9)] }),
  'theme-park': () => ({ parts: [part('commercial/building-e', { fit: 0.5, tint: 0xffc6e0 }), prop('commercial/detail-parasol-a', -0.3, 0.3, 1.1), prop('commercial/detail-parasol-b', 0.3, 0.3, 1.1), prop('suburban/tree-small', 0.35, -0.35, 1)], ground: 'plaza' }),
  zoo: () => ({ parts: [prop('suburban/tree-large', -0.3, -0.2, 1), prop('suburban/tree-large', 0.25, -0.3, 0.9), prop('suburban/fence-low', 0, 0.1, 0.6), prop('suburban/tree-small', 0.3, 0.3, 1)], ground: 'park' }),
  'nature-reserve': () => ({ parts: [[-0.3, -0.3], [0, -0.35], [0.3, -0.25], [-0.32, 0.05], [0.05, 0.02], [0.32, 0.1], [-0.2, 0.33], [0.2, 0.35]].map(([x, z], i) => prop(i % 3 ? 'suburban/tree-large' : 'suburban/tree-small', x, z, 0.9)), ground: 'park' }),
  brewery: () => ({ parts: [part('industrial/building-g', { fit: 0.65 }), prop('industrial/detail-tank', 0.3, 0.35, 0.6)] }),
  farmhouse: () => ({ parts: [part('suburban/building-type-k', { fit: 0.55 }), prop('suburban/fence-low', 0, 0.25, 0.55), prop('suburban/tree-small', 0.35, -0.3, 1)], ground: 'park' }),
  'community-garden': () => ({ parts: [prop('suburban/planter', -0.25, -0.2, 1.2), prop('suburban/planter', 0.2, -0.2, 1.2), prop('suburban/planter', -0.25, 0.2, 1.2), prop('suburban/planter', 0.2, 0.2, 1.2), prop('suburban/tree-small', 0.38, 0, 0.9)], ground: 'park' }),
  playground: () => ({ parts: [prop('suburban/fence-low', 0, 0, 0.62), prop('commercial/detail-parasol-b', 0, 0, 0.9), prop('suburban/tree-small', -0.35, -0.35, 1)], ground: 'park' }),
  'trailer-park': () => ({ parts: [prop('industrial/shipping-container-a', -0.2, -0.15, 0.8, { yaw: 1.57, tint: 0xf3efe2 }), prop('industrial/shipping-container-a', 0.2, 0.15, 0.8, { yaw: 1.57, tint: 0xe2f0f3 }), prop('suburban/tree-small', 0.35, -0.35, 1)] }),
  'market-stall': () => ({ parts: [prop('commercial/detail-awning-wide', 0, 0, 1.4), prop('commercial/detail-parasol-a', -0.3, 0.3, 1), prop('commercial/detail-parasol-b', 0.3, 0.3, 1)], ground: 'plaza' }),
  'gas-station': () => ({ parts: [part('commercial/low-detail-building-wide-b', { fit: 0.6, tint: 0xfff0d0 }), prop('roads/light-square', 0.35, 0.35, 0.9)] }),
  'pocket-park': () => ({ parts: [prop('suburban/tree-large', -0.2, -0.1, 1), prop('suburban/planter', 0.25, 0.25, 1.1), prop('suburban/path-short', 0.1, 0.1, 1.3)], ground: 'park' }),
  'tree-lined-plaza': () => ({ parts: [prop('suburban/tree-small', -0.3, -0.3, 1), prop('suburban/tree-small', 0.3, -0.3, 1), prop('suburban/tree-small', -0.3, 0.3, 1), prop('suburban/tree-small', 0.3, 0.3, 1), prop('suburban/planter', 0, 0, 1.2)], ground: 'plaza' }),
  'botanical-garden': () => ({ parts: [part('commercial/building-c', { fit: 0.45, tint: 0xd6f5e3 }), prop('suburban/tree-large', -0.32, 0.3, 0.9), prop('suburban/tree-large', 0.32, 0.3, 0.9), prop('suburban/planter', 0.3, -0.3, 1)], ground: 'park' }),
  'city-park': () => ({ parts: [prop('suburban/tree-large', -0.3, -0.25, 1), prop('suburban/tree-large', 0.3, 0.25, 1), prop('suburban/tree-small', 0.3, -0.3, 1), prop('suburban/path-long', 0, 0, 1.5), prop('commercial/detail-parasol-a', -0.25, 0.3, 0.9)], ground: 'park' }),
  greenbelt: () => ({ parts: [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3], [0, 0]].map(([x, z]) => prop('suburban/tree-large', x, z, 0.85)), ground: 'park' })
}

/** The family a card is drawn as (mirrors ui/cardText familyOf, without the UI). */
function lookFamily (card) {
  const t = card.tags ?? []
  if (t.includes('landmark') && !t.includes('residential') && !t.includes('commercial')) return 'landmark'
  for (const f of ['residential', 'commercial', 'industrial', 'transit']) if (t.includes(f)) return f
  if (t.includes('green') || t.includes('park')) return 'green'
  if (t.includes('leisure') || t.includes('culture') || t.includes('tourism')) return 'leisure'
  return 'facility'
}

// GENERATED LOOKS (Matt, 2026-10-29: "feel free to generate buildings for
// everything"): every card without a hand-made OVERRIDE gets its own
// building from the generator (buildgen.js), fixed by its id: houses
// recoloured, shops and flats restacked, top-tier towers stretched,
// factories with chimneys and tanks, services colour-coded by what they do.
const SERVICE_COLOUR = { safety: 'slate', police: 'slate', fire: 'rose', health: 'cream', education: 'sand', utility: 'teal', sanitation: 'teal', government: 'charcoal', justice: 'charcoal' }
const pickH = (list, key) => list[hash(key) % list.length]
const way = (key, extra = []) => pickH([...Object.keys(COLOURWAYS), 'a', 'a', 'b', ...extra], key)
const floorsUpTo = (key, n) => hash(`${key}:floors`) % (n + 1)
const roofProps = (key, kit, count) => [...Array(count)].map((_, i) => ({ model: pickH(kit === 'industrial' ? ['industrial/chimney-medium', 'industrial/chimney-large', 'industrial/detail-tank'] : ['industrial/detail-tank', 'industrial/solar-panel-flat', 'industrial/water-tower', 'industrial/chimney-small'], `${key}:p${i}`), dx: ((hash(`${key}:x${i}`) % 5) - 2) * 0.1, dz: ((hash(`${key}:z${i}`) % 5) - 2) * 0.1, yaw: (hash(`${key}:y${i}`) % 4) * Math.PI / 2 }))
const BLOCKS = Object.keys(SOURCES).filter(k => SOURCES[k].kit === 'commercial')
const TOWER_LIST = Object.keys(TOWERS)

/** The generator's spec for a card, by family and tier. */
export function specForCard (card) {
  const key = card.id
  const tier = card.tier ?? 1
  const fam = lookFamily(card)
  const id = `look:${key}`
  const tower = (palette) => ({ id, type: 'tower', src: pickH(TOWER_LIST, key), crown: null, stretch: +(0.8 + (hash(`${key}:s`) % 7) / 10).toFixed(2), palette, props: [] })
  const block = (src, floors, palette, props = []) => ({ id, type: 'block', src, floors, palette, props })
  const whole = (src, palette, props = []) => ({ id, type: 'whole', src, palette, props })
  if (fam === 'residential') {
    if (tier >= 3) return tower(way(key))
    if (tier === 2) return hash(key) % 3 ? block(pickH(BLOCKS, key), floorsUpTo(key, 2), way(key)) : block('suburban/building-type-p', 1 + floorsUpTo(key, 1), way(key))
    return whole(pickH(WHOLE.filter(m => m.startsWith('suburban/')), key), way(key, ['c']))
  }
  if (fam === 'commercial') {
    if (tier >= 3) return tower(way(key))
    return block(pickH(BLOCKS, key), tier === 2 ? 1 + floorsUpTo(key, 2) : 0, way(key), roofProps(key, 'commercial', hash(`${key}:n`) % 2))
  }
  if (fam === 'industrial') {
    if (tier === 2) return block('industrial/building-e', floorsUpTo(key, 2), pickH(['a', 'b', 'c', 'charcoal', 'slate'], key), roofProps(key, 'industrial', 2))
    return whole(pickH(WHOLE.filter(m => m.startsWith('industrial/')), key), pickH(['a', 'b', 'c', 'charcoal', 'sand'], key), roofProps(key, 'industrial', tier >= 3 ? 2 : 1))
  }
  const service = (card.tags ?? []).find(t => t in SERVICE_COLOUR)
  const palette = fam === 'facility' && service ? SERVICE_COLOUR[service] : way(key)
  if (tier >= 3 && fam !== 'facility') return tower(palette)
  return block(pickH(BLOCKS, key), floorsUpTo(key, tier), palette, roofProps(key, 'commercial', 1))
}

/** A look for any building card: { parts, ground }. */
export function lookFor (card) {
  if (OVERRIDES[card.id]) return OVERRIDES[card.id]()
  const tier = card.tier ?? 1
  const fam = lookFamily(card)
  if (fam !== 'green' && fam !== 'transit') {
    const spec = specForCard(card)
    return { parts: [{ gen: spec, model: spec.src, scale: 1, dx: 0, dz: 0, yaw: 0 }], ground: fam === 'landmark' ? 'plaza' : 'built' }
  }
  if (fam === 'green') {
    const n = 2 + (hash(card.id) % 3)
    const spots = [[-0.28, -0.25], [0.28, -0.2], [-0.2, 0.3], [0.3, 0.28], [0, 0]]
    return { parts: spots.slice(0, n).map(([x, z], i) => prop(i % 2 ? 'suburban/tree-small' : 'suburban/tree-large', x, z, 0.95)), ground: 'park' }
  }
  const poolFam = fam === 'landmark' ? 'leisure' : fam
  const pool = POOLS[poolFam]?.[tier] ?? POOLS[poolFam]?.[1] ?? POOLS.facility[1]
  const model = pick(pool, card.id)
  const service = (card.tags ?? []).find(t => t in SERVICE_TINT)
  const tint = fam === 'facility' && service ? SERVICE_TINT[service] : pick(TINTS[fam] ?? [null], `${card.id}:tint`)
  const parts = [part(model, { tier, tint })]
  if (fam === 'commercial' && tier === 1 && hash(card.id) % 2) parts.push(prop('commercial/detail-parasol-a', 0.36, 0.36, 0.8))
  if (fam === 'leisure' && hash(card.id) % 2) parts.push(prop('commercial/detail-parasol-b', 0.36, 0.36, 0.8))
  if (fam === 'industrial' && tier >= 2 && hash(card.id) % 2) parts.push(prop('industrial/chimney-small', -0.36, 0.34, 0.8))
  return { parts, ground: fam === 'landmark' ? 'plaza' : 'built' }
}

/** Every model any look can use, for preloading. */
export function lookModels () {
  const out = new Set(generatorModels())
  Object.values(POOLS).forEach(byTier => Object.values(byTier).forEach(list => list.forEach(m => out.add(m))))
  Object.values(OVERRIDES).forEach(fn => fn().parts.forEach(p => out.add(p.model)))
  ;['commercial/detail-parasol-a', 'commercial/detail-parasol-b', 'industrial/chimney-small', 'suburban/tree-large', 'suburban/tree-small'].forEach(m => out.add(m))
  return [...out]
}
