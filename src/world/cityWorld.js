// The city in three dimensions: Kenney's city kits (CC0, public/models/*)
// under a fixed isometric orthographic camera, the way Commonwealth's table
// does it. Takes the layout from cityLayout.js (lots, model placements,
// road edges and nodes), diffs the placements by id, pops new things in
// and shrinks gone things out. Nothing in here decides what the city looks
// like - that is the layout's job; this file decides how it is drawn.
//
// Matt, round two (2026-10-29): the map is ONE green field with a faint
// grid, not a checkerboard of tiles; roads are drawn as streets (asphalt,
// pavements, lane dashes) from plain geometry; the whole thing is lit like
// daytime, not a cave.

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { PITCH, LOT, GAP, allModels, recipeFor, cornerPoint, edgeCentre } from './cityLayout'
import { makeStreetEdge, makeStreetNode } from './streets'

const MODEL_PATH = `${process.env.BASE_URL || '/'}models/`

const PALETTE = {
  field: 0x8ccf7a, // the grass the whole city sits on
  gridLine: 0x6fb55f, // the faint plot lines in the grass
  gridLineHot: 0xffffff, // ... when aiming
  plate: 0xdfe3ea, // pavement under a building
  park: 0x5fbf6a,
  plaza: 0xeadfc1,
  valid: 0xfff5b8, // a lot you may build on
  cursor: 0xffffff
}

export const renderSafely = (renderer, scene, camera) => {
  const gl = renderer.getContext()
  if (gl.isContextLost()) return false
  try { renderer.render(scene, camera); return true } catch (err) { if (gl.isContextLost()) return false; throw err }
}

const roundedRect = (w, h, r) => {
  const s = new THREE.Shape()
  s.moveTo(-w / 2 + r, -h / 2)
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)
  return s
}

export function createCityWorld (canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.shadowMap.enabled = !reducedMotion
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  const ELEVATION = 0.56
  const AZIMUTH = 0.58
  const dir = new THREE.Vector3(Math.cos(AZIMUTH) * Math.cos(ELEVATION), Math.sin(ELEVATION), Math.sin(AZIMUTH) * Math.cos(ELEVATION))
  camera.position.copy(dir.clone().multiplyScalar(30))
  camera.lookAt(0, 0, 0)

  // Daylight: a bright sky, a warm sun, soft shadows.
  scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x8a7a5a, 1.35))
  const sun = new THREE.DirectionalLight(0xfff6e6, 2.1)
  sun.position.set(4, 8, 3)
  sun.castShadow = !reducedMotion
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far = 40
  sun.shadow.camera.left = -8; sun.shadow.camera.right = 8
  sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8
  sun.shadow.bias = -0.0004
  sun.shadow.radius = 4
  scene.add(sun)
  scene.add(new THREE.AmbientLight(0xffffff, 0.35))

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

  // ------------------------------------------------------- the ground
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...extra })
  const field = new THREE.Group(); world.add(field)
  const gridLines = []
  const plates = new Map() // lot id -> mesh (pavement / park / plaza under a building)
  const overlays = new Map() // lot id -> { valid, ring }
  const pickables = []
  const plateGeo = new THREE.BoxGeometry(LOT + GAP * 0.3, 0.06, LOT + GAP * 0.3)
  const overlayGeo = new THREE.PlaneGeometry(LOT + GAP * 0.3, LOT + GAP * 0.3)
  const ringGeo = new THREE.ShapeGeometry((() => { const s = roundedRect(LOT + GAP * 0.55, LOT + GAP * 0.55, 0.08); s.holes.push(new THREE.Path().setFromPoints(roundedRect(LOT + GAP * 0.3, LOT + GAP * 0.3, 0.06).getPoints(12))); return s })())
  let fieldBuilt = false
  let gridMeta = null

  function buildField (lots, grid) {
    const xs = lots.map(l => l.wx); const zs = lots.map(l => l.wz)
    const minX = Math.min(...xs) - PITCH / 2; const maxX = Math.max(...xs) + PITCH / 2
    const minZ = Math.min(...zs) - PITCH / 2; const maxZ = Math.max(...zs) + PITCH / 2
    const margin = 0.9
    const w = maxX - minX + margin * 2; const h = maxZ - minZ + margin * 2
    const ground = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(w, h, 0.5), { depth: 0.22, bevelEnabled: false }), mat(PALETTE.field))
    ground.rotation.x = -Math.PI / 2
    ground.position.set((minX + maxX) / 2, -0.22, (minZ + maxZ) / 2)
    ground.receiveShadow = true
    field.add(ground)
    // Faint plot lines along every lot boundary (the gap centre lines).
    const lineMat = mat(PALETTE.gridLine, { transparent: true, opacity: 0.55 })
    for (let cx = 0; cx <= grid.width; cx++) {
      const p = cornerPoint(grid, cx, 0)
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, maxZ - minZ), lineMat.clone())
      m.position.set(p.x, 0.004, (minZ + maxZ) / 2); field.add(m); gridLines.push(m)
    }
    for (let cy = 0; cy <= grid.height; cy++) {
      const p = cornerPoint(grid, 0, cy)
      const m = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, 0.012, 0.03), lineMat.clone())
      m.position.set((minX + maxX) / 2, 0.004, p.z); field.add(m); gridLines.push(m)
    }
    gridMeta = { minX, maxX, minZ, maxZ }
    fieldBuilt = true
  }

  // --------------------------------------------------------- the roads
  const roads = new THREE.Group(); world.add(roads)
  const roadMeshes = new Map()
  const streetEdge = (e) => { const g = makeStreetEdge({ axis: e.axis }); g.position.set(e.x, 0, e.z); return g }
  const streetNode = (n) => { const g = makeStreetNode({ arms: n.arms }); g.position.set(n.x, 0, n.z); return g }

  // Aiming at an edge: a pale bar on every edge you may road, a bright one
  // under the cursor, and a translucent street where it would go.
  const edgeBars = new Map()
  const edgeBarGeo = { x: new THREE.PlaneGeometry(LOT + GAP * 0.2, GAP * 0.9), z: new THREE.PlaneGeometry(GAP * 0.9, LOT + GAP * 0.2) }
  let ghostStreetMesh = null

  const live = new Map()
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

  function update ({ grid = null, lots = [], placements = [], roadEdges = [], roadNodes = [], valid = new Set(), cursor = null, ghost = null, validEdges = [], cursorEdge = null } = {}, { instant = false } = {}) {
    if (!fieldBuilt && lots.length && grid) buildField(lots, grid)
    const aiming = valid.size > 0 || validEdges.length > 0
    // A plain field at rest; the plot lines show only while aiming.
    gridLines.forEach(m => { m.material.color.set(aiming ? PALETTE.gridLineHot : PALETTE.gridLine); m.material.opacity = aiming ? 0.55 : 0 })

    // Plates under buildings; overlays for aiming.
    for (const lot of lots) {
      let plate = plates.get(lot.id)
      const wants = lot.ground !== 'empty'
      if (wants && !plate) {
        plate = new THREE.Mesh(plateGeo, mat(PALETTE.plate))
        plate.position.set(lot.wx, -0.01, lot.wz); plate.receiveShadow = true
        world.add(plate); plates.set(lot.id, plate)
      } else if (!wants && plate) { world.remove(plate); plates.delete(lot.id); plate = null }
      if (plate) plate.material.color.set(PALETTE[lot.ground] ?? PALETTE.plate)

      let ov = overlays.get(lot.id)
      if (!ov) {
        const v = new THREE.Mesh(overlayGeo, new THREE.MeshBasicMaterial({ color: PALETTE.valid, transparent: true, opacity: 0, depthWrite: false }))
        v.rotation.x = -Math.PI / 2; v.position.set(lot.wx, 0.03, lot.wz); v.userData.lot = lot
        const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: PALETTE.cursor, transparent: true, opacity: 0, depthWrite: false }))
        ring.rotation.x = -Math.PI / 2; ring.position.set(lot.wx, 0.05, lot.wz)
        world.add(v); world.add(ring); pickables.push(v)
        ov = { valid: v, ring }; overlays.set(lot.id, ov)
      }
      ov.valid.userData.lot = lot
      const isCursor = cursor && cursor.x === lot.x && cursor.y === lot.y
      const isValid = valid.has(`${lot.x},${lot.y}`)
      ov.valid.material.opacity = isValid ? (isCursor ? 0.75 : 0.42) : 0
      ov.ring.material.opacity = isCursor ? 1 : 0
    }

    // Streets: diff by id.
    const wantRoads = new Map([...roadEdges.map(e => [e.id, { kind: 'edge', ...e }]), ...roadNodes.map(n => [n.id, { kind: 'node', ...n }])])
    for (const [id, entry] of roadMeshes) {
      const want = wantRoads.get(id)
      if (!want || (want.kind === 'node' && want.arms.join('') !== entry.arms)) { roads.remove(entry.group); roadMeshes.delete(id) }
    }
    for (const [id, r] of wantRoads) {
      if (roadMeshes.has(id)) continue
      const group = r.kind === 'edge' ? streetEdge(r) : streetNode(r)
      roads.add(group)
      roadMeshes.set(id, { group, arms: r.kind === 'node' ? r.arms.join('') : '' })
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
    // Edges you may road, and the one under the cursor.
    const wantEdges = new Set(validEdges)
    for (const [key, bar] of edgeBars) {
      if (!wantEdges.has(key)) { world.remove(bar); edgeBars.delete(key) }
    }
    if (grid) {
      for (const key of wantEdges) {
        let bar = edgeBars.get(key)
        if (!bar) {
          const e = edgeCentre(grid, key)
          bar = new THREE.Mesh(edgeBarGeo[e.axis], new THREE.MeshBasicMaterial({ color: PALETTE.valid, transparent: true, opacity: 0.5, depthWrite: false }))
          bar.rotation.x = -Math.PI / 2; bar.position.set(e.x, 0.035, e.z)
          world.add(bar); edgeBars.set(key, bar)
        }
        bar.material.color.set(key === cursorEdge ? PALETTE.cursor : PALETTE.valid)
        bar.material.opacity = key === cursorEdge ? 0.95 : 0.45
      }
    }
    if (ghostStreetMesh) { world.remove(ghostStreetMesh); ghostStreetMesh = null }
    if (cursorEdge && grid) {
      const e = edgeCentre(grid, cursorEdge)
      ghostStreetMesh = makeStreetEdge({ axis: e.axis })
      ghostStreetMesh.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.7 } })
      ghostStreetMesh.position.set(e.x, 0.03, e.z)
      world.add(ghostStreetMesh)
    }

    if (!framed && lots.length) frame(lots)
  }

  let bounds = null
  function frame (lots) {
    const xs = lots.map(l => l.wx); const zs = lots.map(l => l.wz)
    bounds = { minX: Math.min(...xs) - PITCH * 0.5 - 0.6, maxX: Math.max(...xs) + PITCH * 0.5 + 0.6, minZ: Math.min(...zs) - PITCH * 0.5 - 0.6, maxZ: Math.max(...zs) + PITCH * 0.5 + 0.6 }
    framed = true
    fit()
  }
  let size = { w: 1, h: 1 }
  function fit () {
    if (!bounds) return
    const corners = []
    for (const x of [bounds.minX, bounds.maxX]) for (const z of [bounds.minZ, bounds.maxZ]) for (const y of [-0.2, 1.3]) corners.push(new THREE.Vector3(x, y, z))
    camera.updateMatrixWorld()
    const view = camera.matrixWorldInverse
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const c of corners) {
      const v = c.clone().applyMatrix4(view)
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y)
    }
    const w = (maxX - minX); const h = (maxY - minY)
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
    // The cursor ring breathes.
    const pulse = 0.75 + 0.25 * Math.sin(t / 220)
    for (const ov of overlays.values()) if (ov.ring.material.opacity > 0) ov.ring.material.opacity = pulse
    renderSafely(renderer, scene, camera)
    requestAnimationFrame(tick)
  }

  return {
    ready,
    update,
    resize,
    project,
    pick,
    /** Stage-pixel centre of a cell / an edge, for aiming in screen directions. */
    screenOfCell: (grid, x, y) => { const c = cornerPoint(grid, x, y); return project(c.x + PITCH / 2, 0, c.z + PITCH / 2) },
    screenOfEdge: (grid, key) => { const e = edgeCentre(grid, key); return project(e.x, 0, e.z) },
    ghostFor: (card, lot) => {
      if (!card || !lot) return []
      const recipe = recipeFor(card, 0)
      return recipe.parts.map((part, i) => ({ id: `ghost:${i}`, model: part.model, x: lot.wx + (part.dx ?? 0) * LOT, z: lot.wz + (part.dz ?? 0) * LOT, yaw: part.yaw ?? 0, scale: part.scale ?? 1, tint: part.tint ?? null }))
    },
    start () { if (!running) { running = true; tick() } },
    dispose () { running = false; renderer.dispose(); renderer.forceContextLoss?.() },
    _debug: { gridMeta: () => gridMeta }
  }
}
