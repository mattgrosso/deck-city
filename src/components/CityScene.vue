<template>
  <div class="scene" :style="{ width: `${width}px`, height: `${height}px` }">
    <canvas ref="canvas" class="scene__canvas" :class="{ 'scene__canvas--ready': ready }" :width="width" :height="height" @click="onClick" />
    <div v-if="!ready && !failed" class="scene__loading">Building the city…</div>
    <div v-if="failed" class="scene__flat">
      <div v-for="lot in lots" :key="lot.id" class="flat-lot" :class="{ 'flat-lot--built': lot.instanceId, 'flat-lot--valid': validSet.has(`${lot.x},${lot.y}`), 'flat-lot--cursor': cursor && cursor.x === lot.x && cursor.y === lot.y }" @click="$emit('cell', { x: lot.x, y: lot.y })" />
    </div>
    <!-- Crisp HTML labels over the canvas: a chip under each building. -->
    <div class="scene__labels">
      <div v-for="label in labels" :key="label.id" class="chip" :class="{ 'chip--monument': label.monument }" :style="{ left: `${label.x}px`, top: `${label.y}px` }">
        <span class="chip__name">{{ label.name }}</span>
        <span v-if="label.stats" class="chip__stats">{{ label.stats }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { layoutCity } from '@/world/cityLayout'

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
    previewCard: { type: Object, default: null },
    width: { type: Number, default: 900 },
    height: { type: Number, default: 580 },
    // The stage's CSS scale, so the canvas renders at true screen pixels.
    stageScale: { type: Number, default: 1 }
  },
  emits: ['cell'],
  data () { return { ready: false, failed: false, labels: [] } },
  computed: {
    layout () { void this.tick; return layoutCity(this.grid, this.structures) },
    lots () { return this.layout.lots },
    validSet () { return new Set(this.validCells.map(c => `${c.x},${c.y}`)) }
  },
  watch: {
    layout () { this.sync() },
    validCells () { this.sync() },
    cursor () { this.sync() },
    previewCard () { this.sync() },
    stageScale () { this.resize() }
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
      this.world?.resize(this.width, this.height, (window.devicePixelRatio || 1) * this.stageScale)
      this.placeLabels()
    },
    sync (opts = {}) {
      if (!this.world) return
      const cursorLot = this.cursor ? this.lots.find(l => l.x === this.cursor.x && l.y === this.cursor.y) : null
      const roadCard = this.targeting && this.previewCard?.placesRoad
      this.world.update({
        grid: this.grid,
        lots: this.lots,
        placements: this.layout.placements,
        roadEdges: this.layout.roadEdges,
        roadNodes: this.layout.roadNodes,
        valid: this.targeting ? this.validSet : new Set(),
        cursor: this.targeting ? this.cursor : null,
        ghost: this.targeting && !roadCard ? this.world.ghostFor(this.previewCard, cursorLot) : [],
        ghostStreet: roadCard ? cursorLot : null
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
        const p = this.world.project(lot.wx + 0.1, 0, lot.wz + 0.78)
        return { id: lot.id, x: p.x, y: p.y, name: inst.card.name, stats: stats.join(' · '), monument: inst.card.type === 'goal' }
      })
    },
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
.scene__canvas { display: block; width: 100%; height: 100%; opacity: 0; transition: opacity 400ms ease; border-radius: 18px; }
.scene__canvas--ready { opacity: 1; }
.scene__loading { position: absolute; inset: 0; display: grid; place-items: center; color: var(--ink-3); font-size: 22px; }
.scene__flat { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; padding: 8px; }
.flat-lot { background: #8ccf7a; border: 2px solid #6fb55f; border-radius: 10px; }
.flat-lot--built { background: #dfe3ea; }
.flat-lot--valid { border-color: #3dd68c; }
.flat-lot--cursor { border-color: #fff; }
.scene__labels { position: absolute; inset: 0; pointer-events: none; }
.chip { position: absolute; transform: translate(-50%, 0); display: flex; flex-direction: column; align-items: center; padding: 2px 8px; border-radius: 8px; background: rgba(255,255,255,0.92); border: 1px solid var(--line); white-space: nowrap; box-shadow: 0 2px 6px rgba(27,33,48,0.15); }
.chip__name { font-size: 12px; font-weight: 800; letter-spacing: 0.02em; }
.chip__stats { font-size: 10.5px; font-weight: 700; color: var(--ink-2); }
.chip--monument { border-color: var(--gold); }
.chip--monument .chip__name { color: #b47a0a; }
</style>
