// The city in three dimensions: Kenney's city kits (CC0, public/models/*)
// under a fixed isometric orthographic camera, the way Commonwealth's table
// does it. Takes the placement list from cityLayout.js, diffs it by id, pops
// new things in and shrinks gone things out. Nothing in here decides what
// the city looks like - that is the layout's job.

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { PITCH, LOT, GAP, allModels, recipeFor } from './cityLayout'

const MODEL_PATH = `${process.env.BASE_URL || '/'}models/`
const BACKDROP = 0x0b0e17

const GROUND = {
  empty: 0x3f6f49, // grass: land waiting for a building
  built: 0x9aa0b0, // pavement under a building
  park: 0x5fbf6a,
  plaza: 0xd9cba3
}

export const renderSafely = (renderer, scene, camera) => {
  const gl = renderer.getContext()
  if (gl.isContextLost()) return false
  try { renderer.render(scene, camera); return true } catch (err) { if (gl.isContextLost()) return false; throw err }
}

export function createCityWorld (canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.shadowMap.enabled = !reducedMotion
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  scene.background = null // transparent: the board floats on the stage
  renderer.setClearColor(BACKDROP, 0)

  // A three-quarter view, tilted enough to see roofs and streets at once.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  const ELEVATION = 0.56
  const AZIMUTH = 0.58
  const dir = new THREE.Vector3(Math.cos(AZIMUTH) * Math.cos(ELEVATION), Math.sin(ELEVATION), Math.sin(AZIMUTH) * Math.cos(ELEVATION))
  camera.position.copy(dir.clone().multiplyScalar(30))
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x5c4a36, 1.1))
  const sun = new THREE.DirectionalLight(0xfff1d8, 2.4)
  sun.position.set(4, 8, 3)
  sun.castShadow = !reducedMotion
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far = 40
  sun.shadow.camera.left = -8; sun.shadow.camera.right = 8
  sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8
  sun.shadow.bias = -0.0005
  scene.add(sun)
  scene.add(new THREE.AmbientLight(0xffffff, 0.3))

  const world = new THREE.Group()
  scene.add(world)


  // ------------------------------------------------------------- models
  const loader = new GLTFLoader()
  const prototypes = new Map()
  const loadModel = (name) => new Promise((resolve) => {
    loader.load(`${MODEL_PATH}${name}.glb`, (gltf) => {
      gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
      prototypes.set(name, gltf.scene)
      resolve(gltf.scene)
    }, undefined, () => resolve(null))
  })
  const ready = Promise.all(allModels().map(loadModel)).then(() => true)

  const instance = (model, tint = null, ghost = false) => {
    const proto = prototypes.get(model)
    if (!proto) { const g = new THREE.Group(); g.userData.missing = true; return g }
    const clone = proto.clone()
    if (tint !== null || ghost) {
      clone.traverse((o) => {
        if (!o.isMesh) return
        o.material = o.material.clone()
        if (tint !== null) o.material.color.set(tint)
        if (ghost) { o.material.transparent = true; o.material.opacity = 0.55; o.castShadow = false }
      })
    }
    return clone
  }

  // ---------------------------------------------------------- the lots
  const lotGeo = new THREE.BoxGeometry(LOT + GAP * 0.35, 0.08, LOT + GAP * 0.35)
  const ringGeo = new THREE.BoxGeometry(LOT + 0.14, 0.02, LOT + 0.14)
  const lotMeshes = new Map() // id -> { mesh, ring, lot }
  const pickables = []

  const live = new Map() // placement id -> { group, placement, born }
  const dying = new Map()
  const ghosts = new Map()
  let framed = false

  const place = (group, p) => {
    group.position.set(p.x, 0, p.z)
    group.rotation.y = p.yaw ?? 0
    const s = p.scale ?? 1
    group.scale.set(s, s, p.scaleZ ?? s)
  }

  const now = () => performance.now()

  function update ({ lots = [], placements = [], valid = new Set(), cursor = null, ghost = null } = {}, { instant = false } = {}) {
    // Lots.
    const seenLots = new Set()
    for (const lot of lots) {
      seenLots.add(lot.id)
      let entry = lotMeshes.get(lot.id)
      if (!entry) {
        const mesh = new THREE.Mesh(lotGeo, new THREE.MeshStandardMaterial({ color: GROUND.empty, roughness: 0.95 }))
        mesh.position.set(lot.wx, -0.04, lot.wz)
        mesh.receiveShadow = true
        mesh.userData.lot = lot
        const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }))
        ring.position.set(lot.wx, 0.012, lot.wz)
        world.add(mesh); world.add(ring); pickables.push(mesh)
        entry = { mesh, ring, lot }
        lotMeshes.set(lot.id, entry)
      }
      entry.lot = lot
      entry.mesh.userData.lot = lot
      const key = `${lot.x},${lot.y}`
      const isCursor = cursor && cursor.x === lot.x && cursor.y === lot.y
      const isValid = valid.has(key)
      const base = GROUND[lot.ground] ?? GROUND.empty
      entry.mesh.material.color.set(isValid ? (isCursor ? 0x8af0a8 : 0x4fb872) : base)
      entry.mesh.material.emissive.set(isValid ? 0x2fbf63 : 0x000000)
      entry.mesh.material.emissiveIntensity = isValid ? (isCursor ? 0.7 : 0.18) : 0
      entry.ring.material.opacity = isCursor ? 0.9 : 0
    }

    // Placements: diff by id.
    const wanted = new Map(placements.map(p => [p.id, p]))
    for (const [id, entry] of live) {
      if (wanted.has(id)) continue
      live.delete(id)
      if (reducedMotion || instant) world.remove(entry.group)
      else dying.set(id, { ...entry, died: now() })
    }
    for (const [id, p] of wanted) {
      const entry = live.get(id)
      if (entry) {
        const stale = entry.group.userData.missing && prototypes.has(p.model)
        if (stale || entry.placement.model !== p.model || entry.placement.tint !== p.tint) {
          world.remove(entry.group)
          live.delete(id)
        } else {
          place(entry.group, p)
          entry.placement = p
          continue
        }
      }
      const group = instance(p.model, p.tint)
      group.userData.placement = p
      place(group, p)
      world.add(group)
      live.set(id, { group, placement: p, born: (reducedMotion || instant) ? 0 : now() })
    }

    // The ghost of what's about to be built, at the cursor.
    const wantGhost = new Map((ghost ?? []).map(p => [p.id, p]))
    for (const [id, entry] of ghosts) {
      if (!wantGhost.has(id)) { world.remove(entry.group); ghosts.delete(id) }
    }
    for (const [id, p] of wantGhost) {
      let entry = ghosts.get(id)
      if (!entry || entry.placement.model !== p.model || (entry.group.userData.missing && prototypes.has(p.model))) {
        if (entry) world.remove(entry.group)
        const group = instance(p.model, p.tint, true)
        world.add(group)
        entry = { group, placement: p }
        ghosts.set(id, entry)
      }
      place(entry.group, p)
      entry.placement = p
    }

    if (!framed && lots.length) frame(lots)
  }

  // Frame the whole grid once: the camera is fixed, so labels can hang off it.
  let bounds = null
  function frame (lots) {
    const xs = lots.map(l => l.wx); const zs = lots.map(l => l.wz)
    bounds = { minX: Math.min(...xs) - PITCH * 0.5, maxX: Math.max(...xs) + PITCH * 0.5, minZ: Math.min(...zs) - PITCH * 0.5, maxZ: Math.max(...zs) + PITCH * 0.5 }
    framed = true
    fit()
  }
  let size = { w: 1, h: 1 }
  function fit () {
    if (!bounds) return
    // Project the bounds' corners into the camera's plane and size the frustum to hold them.
    const corners = []
    for (const x of [bounds.minX, bounds.maxX]) for (const z of [bounds.minZ, bounds.maxZ]) for (const y of [0, 1.4]) corners.push(new THREE.Vector3(x, y, z))
    const view = camera.matrixWorldInverse
    camera.updateMatrixWorld()
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const c of corners) {
      const v = c.clone().applyMatrix4(view)
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y)
    }
    const pad = 1.0
    const w = (maxX - minX) * pad; const h = (maxY - minY) * pad
    const aspect = size.w / size.h
    let halfW = w / 2; let halfH = h / 2
    if (halfW / halfH < aspect) halfW = halfH * aspect; else halfH = halfW / aspect
    const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2
    camera.left = cx - halfW; camera.right = cx + halfW; camera.top = cy + halfH; camera.bottom = cy - halfH
    camera.updateProjectionMatrix()
  }

  function resize (w, h, pixelRatio = 1) {
    size = { w, h }
    renderer.setPixelRatio(Math.min(pixelRatio, 3))
    renderer.setSize(w, h, false)
    fit()
  }

  /** Stage-pixel position of a world point, relative to the canvas. */
  const tmp = new THREE.Vector3()
  function project (x, y, z) {
    tmp.set(x, y, z).project(camera)
    return { x: (tmp.x + 1) / 2 * size.w, y: (1 - tmp.y) / 2 * size.h }
  }

  const raycaster = new THREE.Raycaster()
  function pick (nx, ny) {
    raycaster.setFromCamera(new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1)), camera)
    const hit = raycaster.intersectObjects(pickables, false)[0]
    return hit ? hit.object.userData.lot : null
  }

  // ------------------------------------------------------------- the loop
  let running = false
  const easeOutBack = (t) => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2) }
  function tick () {
    if (!running) return
    const t = now()
    for (const entry of live.values()) {
      if (!entry.born) continue
      const k = Math.min(1, (t - entry.born) / 420)
      const s = easeOutBack(k)
      const p = entry.placement
      entry.group.scale.set(p.scale * s, p.scale * s, (p.scaleZ ?? p.scale) * s)
      if (k >= 1) entry.born = 0
    }
    for (const [id, entry] of dying) {
      const k = Math.min(1, (t - entry.died) / 260)
      const s = 1 - k
      const p = entry.placement
      entry.group.scale.set(p.scale * s, p.scale * s, (p.scaleZ ?? p.scale) * s)
      if (k >= 1) { world.remove(entry.group); dying.delete(id) }
    }
    renderSafely(renderer, scene, camera)
    requestAnimationFrame(tick)
  }

  return {
    ready,
    update,
    resize,
    project,
    pick,
    ghostFor: (card, lot) => {
      if (!card || !lot) return []
      const recipe = recipeFor(card, 0)
      return recipe.parts.map((part, i) => ({ id: `ghost:${i}`, model: part.model, x: lot.wx + (part.dx ?? 0) * LOT, z: lot.wz + (part.dz ?? 0) * LOT, yaw: part.yaw ?? 0, scale: part.scale ?? 1, tint: part.tint ?? null }))
    },
    start () { if (!running) { running = true; tick() } },
    dispose () { running = false; renderer.dispose(); renderer.forceContextLoss?.() }
  }
}
