// Clean cuts along x or z (no triangle crosses): where a building can be
// widened by repeating a bay. node tools/buildgen/axis-cuts.mjs
import { readdirSync } from 'fs'
import { readGlb } from './glb.mjs'
const cutsOn = (glb, axis, eps = 0.004) => {
  const spans = []; let lo = 9; let hi = -9
  for (const p of glb.prims) {
    const idx = p.index ?? [...Array(p.position.length / 3).keys()]
    for (let t = 0; t < idx.length; t += 3) {
      const v = [idx[t], idx[t + 1], idx[t + 2]].map(i => p.position[i * 3 + axis])
      spans.push([Math.min(...v), Math.max(...v)]); lo = Math.min(lo, ...v); hi = Math.max(hi, ...v)
    }
  }
  const out = []
  for (let x = lo + 0.03; x < hi - 0.03; x += 0.005) if (!spans.some(([a, b]) => a < x - eps && b > x + eps)) out.push(+x.toFixed(3))
  const runs = []
  for (const y of out) { const r = runs.at(-1); if (r && y - r[1] <= 0.0051) r[1] = y; else runs.push([y, y]) }
  return { lo: +lo.toFixed(2), hi: +hi.toFixed(2), cuts: runs.map(([a, b]) => +((a + b) / 2).toFixed(3)) }
}
for (const kit of ['commercial', 'industrial', 'suburban']) {
  for (const f of readdirSync(`public/models/${kit}`).filter(f => f.startsWith('building') && f.endsWith('.glb'))) {
    const g = readGlb(`public/models/${kit}/${f}`)
    const x = cutsOn(g, 0); const z = cutsOn(g, 2)
    if (x.cuts.length || z.cuts.length) console.log(`${kit}/${f.replace('.glb', '')}  x[${x.lo},${x.hi}] ${x.cuts.join(' ')}  |  z[${z.lo},${z.hi}] ${z.cuts.join(' ')}`)
  }
}
