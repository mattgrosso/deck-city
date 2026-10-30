// Read a Kenney GLB (one mesh, palette texture) into plain arrays, for the
// building generator. No three.js needed: positions, normals, uvs, indices.
import { readFileSync } from 'fs'

export function readGlb (file) {
  const b = readFileSync(file)
  const jsonLen = b.readUInt32LE(12)
  const j = JSON.parse(b.slice(20, 20 + jsonLen).toString())
  const bin = 20 + jsonLen + 8
  const read = (accIndex) => {
    const acc = j.accessors[accIndex]
    const bv = j.bufferViews[acc.bufferView]
    const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type]
    const size = { 5126: 4, 5123: 2, 5125: 4, 5121: 1 }[acc.componentType]
    const stride = bv.byteStride || comps * size
    const start = bin + (bv.byteOffset || 0) + (acc.byteOffset || 0)
    const out = new Array(acc.count * comps)
    for (let i = 0; i < acc.count; i++) {
      for (let c = 0; c < comps; c++) {
        const at = start + i * stride + c * size
        out[i * comps + c] = acc.componentType === 5126 ? b.readFloatLE(at) : acc.componentType === 5123 ? b.readUInt16LE(at) : acc.componentType === 5125 ? b.readUInt32LE(at) : b.readUInt8(at)
      }
    }
    return out
  }
  const prims = j.meshes[0].primitives.map(p => ({
    material: j.materials[p.material]?.name,
    position: read(p.attributes.POSITION),
    normal: p.attributes.NORMAL != null ? read(p.attributes.NORMAL) : null,
    uv: p.attributes.TEXCOORD_0 != null ? read(p.attributes.TEXCOORD_0) : null,
    index: p.indices != null ? read(p.indices) : null
  }))
  return { prims, node: j.nodes[0] }
}

/** Heights a horizontal cut can pass through without splitting any triangle. */
export function cleanCuts (glb, eps = 0.004) {
  const spans = []
  let top = 0
  for (const p of glb.prims) {
    const idx = p.index ?? [...Array(p.position.length / 3).keys()]
    for (let t = 0; t < idx.length; t += 3) {
      const ys = [idx[t], idx[t + 1], idx[t + 2]].map(i => p.position[i * 3 + 1])
      spans.push([Math.min(...ys), Math.max(...ys)])
      top = Math.max(top, ...ys)
    }
  }
  const out = []
  for (let y = 0.02; y < top - 0.02; y += 0.005) {
    if (!spans.some(([a, b]) => a < y - eps && b > y + eps)) out.push(+y.toFixed(3))
  }
  // Collapse runs into their middles.
  const runs = []
  for (const y of out) { const r = runs.at(-1); if (r && y - r[1] <= 0.0051) r[1] = y; else runs.push([y, y]) }
  return { top: +top.toFixed(3), cuts: runs.map(([a, b]) => +((a + b) / 2).toFixed(3)) }
}
