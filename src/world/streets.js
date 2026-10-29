// Streets, built from plain geometry: an asphalt bed, a pavement along each
// side, lane dashes. Shared by the board (cityWorld.js) and the card
// pictures (dev-art.html), so a Road card shows the street it lays.

import * as THREE from 'three'
import { LOT, GAP } from './cityLayout'

export const STREET = {
  asphalt: 0x5a6070,
  dash: 0xf2f3f6,
  kerb: 0xd6dae3,
  kerbWidth: 0.07,
  y: 0.02
}

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...extra })
let shared = null
const materials = () => {
  if (!shared) {
    shared = {
      asphalt: mat(STREET.asphalt, { roughness: 0.9 }),
      kerb: mat(STREET.kerb),
      dash: mat(STREET.dash, { emissive: STREET.dash, emissiveIntensity: 0.15 })
    }
  }
  return shared
}

/** One street segment between two spaces, centred on the origin. `axis` is the direction it runs: 'x' or 'z'. */
export function makeStreetEdge ({ axis = 'x', length = LOT } = {}) {
  const m = materials()
  const g = new THREE.Group()
  const along = axis === 'x'
  const K = STREET.kerbWidth
  const bed = new THREE.Mesh(new THREE.BoxGeometry(along ? length : GAP, 0.04, along ? GAP : length), m.asphalt)
  bed.position.y = STREET.y; bed.receiveShadow = true; g.add(bed)
  for (const side of [-1, 1]) {
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(along ? length : K, 0.06, along ? K : length), m.kerb)
    kerb.position.set(along ? 0 : side * (GAP / 2 - K / 2), STREET.y + 0.012, along ? side * (GAP / 2 - K / 2) : 0)
    kerb.receiveShadow = true; g.add(kerb)
  }
  const n = Math.max(1, Math.round(length / 0.33))
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n * length - length / 2
    const dash = new THREE.Mesh(new THREE.BoxGeometry(along ? 0.16 : 0.025, 0.012, along ? 0.025 : 0.16), m.dash)
    dash.position.set(along ? k : 0, STREET.y + 0.026, along ? 0 : k); g.add(dash)
  }
  return g
}

/** A junction square, with a pavement across every side that has no street ('n','e','s','w' in `arms`). */
export function makeStreetNode ({ arms = [] } = {}) {
  const m = materials()
  const g = new THREE.Group()
  const K = STREET.kerbWidth
  const bed = new THREE.Mesh(new THREE.BoxGeometry(GAP, 0.04, GAP), m.asphalt)
  bed.position.y = STREET.y; bed.receiveShadow = true; g.add(bed)
  const sides = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }
  for (const [d, [dx, dz]] of Object.entries(sides)) {
    if (arms.includes(d)) continue
    const across = dx === 0
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(across ? GAP : K, 0.06, across ? K : GAP), m.kerb)
    kerb.position.set(dx * (GAP / 2 - K / 2), STREET.y + 0.012, dz * (GAP / 2 - K / 2))
    g.add(kerb)
  }
  return g
}
