// THE BUILDING GENERATOR (Matt, 2026-10-29: "spend some time deconstructing
// how these buildings are made so that you could generate buildings for me
// so we would sort of have an infinite supply... let's maintain the style").
//
// Every Kenney building is ONE mesh on a shared palette texture, so new
// buildings are made from the real ones, cut where no triangle crosses
// (tools/buildgen/analyse.mjs finds those heights):
//   - restack: a building's ground floor, its middle floor repeated, its top
//   - stretch: a skyscraper's body pulled taller (its facade is vertical strips)
//   - crown swap: one tower's top on another tower of the same footprint
//   - palette: Kenney's own alternate colourways (Textures/variation-*.png)
//   - props: chimneys, tanks, solar panels, a water tower or parasols on the roof
//
// A building is a SPEC (plain data, below); assembleBuilding turns a spec
// into a three.js group from the loaded prototypes. Specs are deterministic
// from a seed, chosen now and kept - nothing is invented during play.

import * as THREE from 'three'

// Where each source building may be cut: base = [0, base], one floor =
// [floor[0], floor[1]], cap = [cap, top]. Heights in model units.
export const SOURCES = {
  'commercial/building-b': { kit: 'commercial', base: 0.4, floor: [0.4, 0.8], cap: 0.8 },
  'commercial/building-d': { kit: 'commercial', base: 0.4, floor: [0.4, 0.8], cap: 0.8 },
  'commercial/building-e': { kit: 'commercial', base: 0.4, floor: [0.4, 0.8], cap: 0.8 },
  'commercial/building-f': { kit: 'commercial', base: 0.45, floor: [0.45, 0.85], cap: 0.85 },
  'commercial/building-i': { kit: 'commercial', base: 0.45, floor: [0.45, 0.85], cap: 0.85 },
  'commercial/building-m': { kit: 'commercial', base: 0.45, floor: [0.45, 0.85], cap: 0.85 },
  'commercial/building-n': { kit: 'commercial', base: 0.85, floor: [0.85, 1.25], cap: 1.25 },
  'suburban/building-type-p': { kit: 'suburban', base: 0.45, floor: [0.45, 0.8], cap: 0.8 },
  'industrial/building-e': { kit: 'industrial', base: 0.5, floor: [0.5, 0.9], cap: 0.9 }
}
// Towers: base [0, 0.8], body [0.8, body] stretched, crown [body, top].
// Pairs with the same footprint may swap crowns.
export const TOWERS = {
  'commercial/building-skyscraper-a': { kit: 'commercial', base: 0.8, body: 2.8, footprint: 'square' },
  'commercial/building-skyscraper-b': { kit: 'commercial', base: 0.8, body: 4.4, footprint: 'square' },
  'commercial/building-skyscraper-c': { kit: 'commercial', base: 0.8, body: 3.6, footprint: 'slim' },
  'commercial/building-skyscraper-d': { kit: 'commercial', base: 0.8, body: 5.2, footprint: 'slim' },
  'commercial/building-skyscraper-e': { kit: 'commercial', base: 0.8, body: 4.0, footprint: 'e' }
}
export const PALETTES = { commercial: ['a', 'b'], suburban: ['a', 'b', 'c'], industrial: ['a', 'b', 'c'] }

// Our own colourways: the kit's palette with only the WALL colours (the warm
// brick/sand/terracotta swatches) moved to a new hue, lightness and
// saturation. Windows, trim and roofs keep Kenney's colours, so the style
// holds. { hue: target hue in degrees, sat: saturation multiplier, light: added lightness }
export const COLOURWAYS = {
  slate: { hue: 212, sat: 0.55, light: 0.02 },
  sage: { hue: 115, sat: 0.4, light: 0.04 },
  cream: { hue: 40, sat: 0.35, light: 0.22 },
  sand: { hue: 38, sat: 0.7, light: 0.1 },
  rose: { hue: 350, sat: 0.6, light: 0.06 },
  charcoal: { hue: 220, sat: 0.12, light: -0.12 },
  teal: { hue: 178, sat: 0.5, light: 0 },
  mustard: { hue: 46, sat: 1.1, light: 0.02 }
}
const ALL_PALETTES = (kit) => [...PALETTES[kit], ...Object.keys(COLOURWAYS)]
const ROOF_PROPS = {
  commercial: ['industrial/detail-tank', 'industrial/solar-panel-flat', 'industrial/water-tower', 'commercial/detail-parasol-a', 'industrial/chimney-small'],
  suburban: ['industrial/solar-panel-flat', 'industrial/chimney-small'],
  industrial: ['industrial/chimney-medium', 'industrial/chimney-large', 'industrial/detail-tank-large', 'industrial/detail-tank']
}

/** Every model the generator may need, so the world can preload them. */
export function generatorModels () {
  const out = new Set([...Object.keys(SOURCES), ...Object.keys(TOWERS)])
  Object.values(ROOF_PROPS).forEach(l => l.forEach(m => out.add(m)))
  return [...out]
}

const rngFrom = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647 } }
const pick = (rng, list) => list[Math.floor(rng() * list.length)]

/** One spec from a seed. `kind`: 'block' | 'tower' | 'any'. */
export function specFromSeed (seed, { kind = 'any', kit = null } = {}) {
  const rng = rngFrom(seed * 7919 + 13)
  const towerish = kind === 'tower' || (kind === 'any' && !kit && rng() < 0.3)
  if (towerish) {
    const src = pick(rng, Object.keys(TOWERS))
    const mates = Object.keys(TOWERS).filter(k => TOWERS[k].footprint === TOWERS[src].footprint)
    return { id: `gen-${seed}`, type: 'tower', src, crown: pick(rng, mates), stretch: +(0.6 + rng() * 1.1).toFixed(2), palette: pick(rng, ALL_PALETTES('commercial')), props: [] }
  }
  const pool = Object.keys(SOURCES).filter(k => !kit || SOURCES[k].kit === kit)
  const src = pick(rng, pool)
  const s = SOURCES[src]
  const floors = Math.floor(rng() * (s.kit === 'commercial' ? 6 : 3))
  const props = []
  const nProps = Math.floor(rng() * 3)
  for (let i = 0; i < nProps; i++) props.push({ model: pick(rng, ROOF_PROPS[s.kit]), dx: +((rng() - 0.5) * 0.4).toFixed(2), dz: +((rng() - 0.5) * 0.4).toFixed(2), yaw: Math.floor(rng() * 4) * Math.PI / 2 })
  return { id: `gen-${seed}`, type: 'block', src, floors, palette: pick(rng, ALL_PALETTES(s.kit)), props }
}

// ------------------------------------------------------------- assembly

/** The triangles of `geometry` between y0 and y1 (by centroid), moved so height `from` lands at `dy`, and scaled in y. */
function sliceGeometry (geometry, y0, y1, { dy = 0, sy = 1, from = y0 } = {}) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry
  const pos = g.attributes.position
  const keep = []
  for (let t = 0; t < pos.count; t += 3) {
    const cy = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3
    if (cy >= y0 && cy < y1) keep.push(t)
  }
  const out = new THREE.BufferGeometry()
  // Through the attribute's own getters: a glTF attribute may be interleaved
  // or quantised, so its raw array is not one value per slot.
  const get = ['getX', 'getY', 'getZ', 'getW']
  for (const [name, attr] of Object.entries(g.attributes)) {
    const arr = new Float32Array(keep.length * 3 * attr.itemSize)
    keep.forEach((t, k) => { for (let v = 0; v < 3; v++) for (let c = 0; c < attr.itemSize; c++) arr[(k * 3 + v) * attr.itemSize + c] = attr[get[c]](t + v) })
    out.setAttribute(name, new THREE.BufferAttribute(arr, attr.itemSize))
  }
  const p = out.attributes.position
  for (let i = 0; i < p.count; i++) p.setY(i, (p.getY(i) - from) * sy + dy)
  if (sy !== 1) out.computeVertexNormals()
  return out
}

/** The meshes of a prototype, with their materials (a Kenney model is one or two). */
function meshesOf (proto) {
  const list = []
  proto.updateMatrixWorld(true)
  proto.traverse(o => { if (o.isMesh) { const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); list.push({ geo, material: o.material }) } })
  return list
}

const textureCache = new Map()
const pending = new Set()
/** Resolves once every palette texture asked for so far has loaded (for a renderer that draws once). */
export const texturesReady = () => Promise.all([...pending])
const rgbToHsl = (r, g, b) => {
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const dd = max - min; const sat = l > 0.5 ? dd / (2 - max - min) : dd / (max + min)
  const h = max === r ? (g - b) / dd + (g < b ? 6 : 0) : max === g ? (b - r) / dd + 2 : (r - g) / dd + 4
  return [h * 60, sat, l]
}
const hslToRgb = (h, sat, l) => {
  const c = (1 - Math.abs(2 * l - 1)) * sat; const x = c * (1 - Math.abs((h / 60) % 2 - 1)); const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [r + m, g + m, b + m]
}
/** A wall pixel: warm (red to orange-yellow) and not grey. */
const isWall = (h, sat) => sat > 0.22 && (h < 48 || h > 345)

/** The kit's palette recoloured to a colourway, as a canvas texture. */
function colourwayTexture (was, kit, name, base) {
  const way = COLOURWAYS[name]
  const canvas = document.createElement('canvas')
  const tex = new THREE.CanvasTexture(canvas)
  for (const k of ['flipY', 'colorSpace', 'wrapS', 'wrapT', 'magFilter', 'minFilter', 'channel', 'generateMipmaps']) tex[k] = was[k]
  const done = new THREE.ImageLoader().loadAsync(`${base}models/${kit}/Textures/colormap.png`).then((img) => {
    canvas.width = img.width; canvas.height = img.height
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0)
    const data = ctx.getImageData(0, 0, img.width, img.height)
    const px = data.data
    for (let i = 0; i < px.length; i += 4) {
      const [h, sat, l] = rgbToHsl(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255)
      if (!isWall(h, sat)) continue
      const [r, g, b] = hslToRgb(way.hue, Math.min(1, sat * way.sat), Math.max(0, Math.min(1, l + way.light)))
      px[i] = r * 255; px[i + 1] = g * 255; px[i + 2] = b * 255
    }
    ctx.putImageData(data, 0, 0)
    tex.needsUpdate = true
  }).catch(() => {})
  pending.add(done)
  return tex
}

function paletteMaterial (material, kit, palette, base) {
  if (!palette || palette === 'a' || !material.map) return material
  const url = COLOURWAYS[palette] ? `${kit}:${palette}` : `${base}models/${kit}/Textures/variation-${palette}.png`
  let tex = textureCache.get(url)
  if (!tex && COLOURWAYS[palette]) { tex = colourwayTexture(material.map, kit, palette, base); textureCache.set(url, tex) }
  if (!tex) {
    const was = material.map
    tex = new THREE.TextureLoader().load(url)
    pending.add(new Promise(resolve => { const t = setInterval(() => { if (tex.image) { clearInterval(t); resolve() } }, 30) }))
    for (const k of ['flipY', 'colorSpace', 'wrapS', 'wrapT', 'magFilter', 'minFilter', 'channel', 'generateMipmaps']) tex[k] = was[k]
    textureCache.set(url, tex)
  }
  const m = material.clone()
  m.map = tex
  return m
}

/**
 * A spec as a three.js group, from loaded prototypes (`get(name)` returns a
 * model's scene). Returns { group, height }.
 */
export function assembleBuilding (spec, get, { base = '/' } = {}) {
  const group = new THREE.Group()
  const add = (geo, material, kit) => {
    const mesh = new THREE.Mesh(geo, paletteMaterial(material, kit, spec.palette, base))
    mesh.castShadow = true; mesh.receiveShadow = true
    group.add(mesh)
  }
  let height = 0
  if (spec.type === 'tower') {
    const t = TOWERS[spec.src]
    const c = TOWERS[spec.crown ?? spec.src]
    const body = (t.body - t.base) * spec.stretch
    for (const { geo, material } of meshesOf(get(spec.src))) {
      add(sliceGeometry(geo, -1, t.base, { from: 0 }), material, t.kit)
      add(sliceGeometry(geo, t.base, t.body, { dy: t.base, sy: spec.stretch }), material, t.kit)
    }
    for (const { geo, material } of meshesOf(get(spec.crown ?? spec.src))) add(sliceGeometry(geo, c.body, 99, { dy: t.base + body }), material, c.kit)
    height = t.base + body
  } else {
    const s = SOURCES[spec.src]
    const fh = s.floor[1] - s.floor[0]
    for (const { geo, material } of meshesOf(get(spec.src))) {
      add(sliceGeometry(geo, -1, s.base, { from: 0 }), material, s.kit)
      // The source's own middle (base..cap) once, then `floors` more of its floor.
      add(sliceGeometry(geo, s.base, s.cap, { dy: s.base }), material, s.kit)
      for (let f = 0; f < spec.floors; f++) add(sliceGeometry(geo, s.floor[0], s.floor[1], { dy: s.cap + f * fh }), material, s.kit)
      add(sliceGeometry(geo, s.cap, 99, { dy: s.cap + spec.floors * fh }), material, s.kit)
    }
    height = s.cap + spec.floors * fh
    // Props stand on the roof where they are: a ray straight down finds it.
    group.updateMatrixWorld(true)
    const top = new THREE.Box3().setFromObject(group).max.y + 1
    const ray = new THREE.Raycaster()
    for (const p of spec.props ?? []) {
      const proto = get(p.model)
      if (!proto) continue
      ray.set(new THREE.Vector3(p.dx, top, p.dz), new THREE.Vector3(0, -1, 0))
      const hit = ray.intersectObjects(group.children, false)[0]
      if (!hit || hit.point.y < height * 0.8) continue // off the roof, or down a light well
      const prop = proto.clone()
      prop.scale.setScalar(0.5)
      prop.position.set(p.dx, hit.point.y, p.dz)
      prop.rotation.y = p.yaw ?? 0
      prop.traverse(o => { if (o.isMesh) { o.castShadow = true } })
      group.add(prop)
    }
  }
  return { group, height }
}
