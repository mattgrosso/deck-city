<template>
  <div class="scene" :style="{ width: `${width}px`, height: `${height}px` }">
    <canvas ref="canvas" class="scene__canvas" :class="{ 'scene__canvas--ready': ready }" :width="width" :height="height" @click="onClick" />
    <div v-if="!ready && !failed" class="scene__loading">Building the city…</div>
    <div v-if="failed" class="scene__flat">
      <div v-for="lot in lots" :key="lot.id" class="flat-lot" :class="{ 'flat-lot--built': lot.instanceId, 'flat-lot--valid': validSet.has(`${lot.x},${lot.y}`), 'flat-lot--cursor': cursor && cursor.x === lot.x && cursor.y === lot.y }" @click="$emit('cell', { x: lot.x, y: lot.y })" />
    </div>
    <!-- Crisp HTML labels over the canvas: a chip under each building. -->
    <div class="scene__labels">
      <div v-for="m in placedMarks" :key="m.key" class="mark" :class="`mark--${m.tone}`" :style="{ left: `${m.sx}px`, top: `${m.sy}px` }">{{ m.text }}</div>
    </div>
    <div v-if="showLabels" class="scene__labels">
      <div v-for="label in labels" :key="label.id" class="chip" :class="{ 'chip--monument': label.monument }" :style="{ left: `${label.x}px`, top: `${label.y}px` }">
        <span class="chip__name">{{ label.name }}</span><span v-if="label.stats" class="chip__stats">{{ label.stats }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { layoutCity, cellCentre, edgeCentre, LOT } from '@/world/cityLayout'

const STAT_SHORT = { population: 'pop', jobs: 'jobs', revenue: 'rev' }

// The city board: the engine's grid and buildings drawn by world/cityWorld.js
// (three.js) with the layout from world/cityLayout.js. Props are the engine's
// own objects plus the targeting state; `tick` is what makes it re-read them.
export default {
  name: 'CityScene',
  props: {
    grid: { type: Object, required: true },
    structures: { type: Array, required: true },
    tick: { type: Number, required: true },
    targeting: Boolean,
    validCells: { type: Array, default: () => [] },
    cursor: { type: Object, default: null },
    validEdges: { type: Array, default: () => [] }, // edge keys a Road may go on
    cursorEdge: { type: String, default: null },
    plannedEdges: { type: Array, default: () => [] }, // segments already aimed by the Road card in hand
    previewCard: { type: Object, default: null },
    ghostCells: { type: Array, default: () => [] },
    // Building chips show only while inspecting the map (Matt: "those should
    // only appear when I am inspecting").
    showLabels: { type: Boolean, default: false },
    // Change chips over neighbouring plots while aiming: [{ x, y, text, tone }].
    marks: { type: Array, default: () => [] },
    width: { type: Number, default: 1920 },
    height: { type: Number, default: 1080 },
    // Where on the canvas the city is framed (canvas pixels); the rest is grass under the UI.
    rect: { type: Object, default: null },
    // The stage's CSS scale, so the canvas renders at true screen pixels.
    stageScale: { type: Number, default: 1 }
  },
  emits: ['cell'],
  data () { return { ready: false, failed: false, labels: [] } },
  computed: {
    layout () { void this.tick; return layoutCity(this.grid, this.structures) },
    lots () { return this.layout.lots },
    validSet () { return new Set(this.validCells.map(c => `${c.x},${c.y}`)) },
    placedMarks () {
      void this.tick
      if (!this.world || !this.ready) return []
      return this.marks.map(m => { const c = cellCentre(this.grid, m.x, m.y); const p = this.world.project(c.x, 0.9, c.z); return { ...m, key: `${m.x},${m.y}`, sx: p.x, sy: p.y } })
    }
  },
  watch: {
    layout () { this.sync() },
    validCells () { this.sync() },
    ghostCells () { this.sync() },
    cursor () { this.sync() },
    validEdges () { this.sync() },
    cursorEdge () { this.sync() },
    plannedEdges () { this.sync() },
    previewCard () { this.sync() },
    stageScale () { this.resize() },
    rect () { this.resize() }
  },
  async mounted () {
    try {
      const { createCityWorld } = await import('@/world/cityWorld')
      this.world = createCityWorld(this.$refs.canvas, { reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches })
    } catch (err) {
      // No WebGL (jsdom, an old TV browser): a flat board still plays.
      console.warn('City scene unavailable', err)
      this.failed = true
      return
    }
    this.resize()
    this.sync({ instant: true })
    this.world.start()
    this.world.ready
      .then(() => { this.ready = true; this.sync({ instant: true }); return true })
      .catch((err) => console.warn('City models failed to load', err))
  },
  beforeUnmount () { this.world?.dispose() },
  methods: {
    resize () {
      this.world?.resize(this.width, this.height, (window.devicePixelRatio || 1) * this.stageScale, this.rect)
      this.placeLabels()
    },
    sync (opts = {}) {
      if (!this.world) return
      const cursorLot = this.cursor ? this.lots.find(l => l.x === this.cursor.x && l.y === this.cursor.y) : null
      this.world.update({
        grid: this.grid,
        lots: this.lots,
        placements: this.layout.placements,
        roadEdges: this.layout.roadEdges,
        roadNodes: this.layout.roadNodes,
        bridges: this.layout.bridges,
        valid: this.targeting ? this.validSet : new Set(),
        cursor: this.targeting ? this.cursor : null,
        cursorCells: this.targeting ? this.ghostCells : [],
        ghost: this.targeting && this.cursor ? this.world.ghostFor(this.previewCard, cursorLot, this.ghostCells, this.grid) : [],
        validEdges: this.targeting ? this.validEdges : [],
        cursorEdge: this.targeting ? this.cursorEdge : null,
        plannedEdges: this.targeting ? this.plannedEdges : [],
        extraPoints: [...this.nearWater(), ...(this.targeting ? this.aimPoints() : [])]
      }, opts)
      this.placeLabels()
    },
    placeLabels () {
      if (!this.world) { this.labels = []; return }
      const byId = new Map(this.structures.map(s => [s.instanceId, s]))
      this.labels = this.lots.filter(l => l.instanceId).map((lot) => {
        const inst = byId.get(lot.instanceId)
        const stats = Object.entries(inst.card.stats ?? {}).filter(([, v]) => v).map(([k, v]) => `+${v} ${STAT_SHORT[k] ?? k}`)
        if (inst.slots) stats.push(`${inst.slots.used}/${inst.slots.capacity} slots`)
        const p = this.world.project(lot.wx + LOT / 2, 0, lot.wz + LOT / 2)
        return { id: lot.id, x: p.x, y: p.y, name: inst.card.name, stats: stats.join(' · '), monument: inst.card.type === 'goal' }
      })
    },
    /** Water within a few plots of the city: framed too, so the map's lake or river is part of the view, not just off the edge of it. */
    nearWater () {
      const built = this.lots.filter(l => l.instanceId)
      return this.lots
        .filter(l => l.ground === 'water' && built.some(b => Math.abs(b.x - l.x) <= 3 && Math.abs(b.y - l.y) <= 3))
        .map(l => ({ x: l.wx, z: l.wz }))
    },
    /** Where the player may aim or is looking: the camera keeps these in frame. */
    aimPoints () {
      const pts = []
      const cells = this.validCells.length ? this.validCells : (this.cursor ? [this.cursor] : [])
      for (const c of cells) pts.push(cellCentre(this.grid, c.x, c.y))
      for (const key of [...this.validEdges, ...this.plannedEdges]) pts.push(edgeCentre(this.grid, key))
      if (this.cursor) pts.push(cellCentre(this.grid, this.cursor.x, this.cursor.y))
      return pts
    },
    /** Stage-pixel positions, so the app can move the cursor in SCREEN directions on an isometric board. */
    screenOfCell (x, y) { return this.world ? this.world.screenOfCell(this.grid, x, y) : { x: x * 100, y: y * 100 } },
    screenOfEdge (key) { return this.world ? this.world.screenOfEdge(this.grid, key) : { x: 0, y: 0 } },
    onClick (event) {
      if (!this.world) return
      const rect = this.$refs.canvas.getBoundingClientRect()
      const lot = this.world.pick((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height)
      if (lot) this.$emit('cell', { x: lot.x, y: lot.y })
    }
  }
}
</script>

<style scoped>
.scene { position: relative; }
.scene__canvas { display: block; width: 100%; height: 100%; opacity: 0; transition: opacity 400ms ease; }
.scene__canvas--ready { opacity: 1; }
.scene__loading { position: absolute; left: 400px; top: 400px; color: var(--ink-3); font-size: 22px; }
.scene__flat { position: absolute; left: 40px; top: 100px; width: 1100px; height: 660px; display: grid; grid-template-columns: repeat(12, 1fr); gap: 6px; padding: 8px; background: #8ccf7a; border-radius: 18px; }
.flat-lot { background: #8ccf7a; border: 2px solid #6fb55f; border-radius: 10px; }
.flat-lot--built { background: #dfe3ea; }
.flat-lot--valid { border-color: #3dd68c; }
.flat-lot--cursor { border-color: #fff; }
.scene__labels { position: absolute; inset: 0; pointer-events: none; }
.chip { position: absolute; transform: translate(-50%, 0); display: flex; gap: 6px; align-items: baseline; padding: 1px 7px; border-radius: 7px; background: rgba(255,255,255,0.92); border: 1px solid var(--line); white-space: nowrap; box-shadow: 0 2px 6px rgba(27,33,48,0.15); }
.chip__name { font-size: 11px; font-weight: 800; letter-spacing: 0.02em; }
.chip__stats { font-size: 10px; font-weight: 700; color: var(--ink-2); }
.mark { position: absolute; transform: translate(-50%, -100%); padding: 3px 9px; border-radius: 999px; font-size: 14px; font-weight: 800; white-space: nowrap; box-shadow: 0 4px 12px rgba(27,33,48,0.2); animation: mark-in 180ms ease-out; }
.mark--good { background: #2fb36a; color: #fff; }
.mark--bad { background: #e0434b; color: #fff; }
@keyframes mark-in { from { opacity: 0; transform: translate(-50%, -80%); } }
.chip--monument { border-color: var(--gold); }
.chip--monument .chip__name { color: #b47a0a; }
</style>
