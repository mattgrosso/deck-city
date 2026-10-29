<template>
  <div class="board" :class="{ 'board--targeting': targeting }" :style="{ width: `${w}px`, height: `${h}px` }">
    <div
      v-for="cell in cells"
      :key="cell.key"
      class="cell"
      :class="{
        'cell--valid': targeting && cell.valid,
        'cell--invalid': targeting && !cell.valid,
        'cell--cursor': targeting && cursor && cursor.x === cell.x && cursor.y === cell.y,
        'cell--built': !!cell.instance
      }"
      :style="{ left: `${cell.px}px`, top: `${cell.py}px`, width: `${size}px`, height: `${size}px` }"
      @click="$emit('cell', { x: cell.x, y: cell.y })"
    >
      <div v-for="side in cell.roads" :key="side" class="road" :class="`road--${side}`" />
      <div v-if="cell.instance" class="tile" :class="[`tile--${cell.family}`, { 'tile--monument': cell.monument }]" :style="{ '--c': cell.color, '--art-ink': cell.ink }">
        <svg viewBox="0 0 24 24"><path :d="cell.icon" /></svg>
        <div class="tile__name">{{ cell.instance.card.name }}</div>
        <div class="tile__stats">
          <span v-for="s in cell.stats" :key="s">{{ s }}</span>
        </div>
      </div>
      <div v-else-if="targeting && cell.valid" class="cell__dot" />
    </div>
    <div v-if="targeting && previewCard && cursor" class="ghost" :style="ghostStyle">
      <svg viewBox="0 0 24 24"><path :d="previewIcon" /></svg>
      <span>{{ previewCard.name }}</span>
    </div>
  </div>
</template>

<script>
import { cellEdgeKeys } from '@/game/core'
import { familyOf, FAMILIES } from '@/ui/cardText'
import { ICONS, iconFor } from '@/ui/icons'

const STAT_SHORT = { population: 'pop', jobs: 'jobs', revenue: 'rev' }

export default {
  name: 'CityBoard',
  props: {
    grid: { type: Object, required: true },
    structures: { type: Array, required: true },
    tick: { type: Number, required: true },
    targeting: Boolean,
    validCells: { type: Array, default: () => [] },
    cursor: { type: Object, default: null },
    previewCard: { type: Object, default: null },
    size: { type: Number, default: 124 },
    gap: { type: Number, default: 10 }
  },
  emits: ['cell'],
  computed: {
    step () { return this.size + this.gap },
    w () { return this.grid.width * this.step - this.gap },
    h () { return this.grid.height * this.step - this.gap },
    validSet () { return new Set(this.validCells.map(c => `${c.x},${c.y}`)) },
    cells () {
      void this.tick
      const byId = new Map(this.structures.map(s => [s.instanceId, s]))
      const out = []
      for (let y = 0; y < this.grid.height; y++) {
        for (let x = 0; x < this.grid.width; x++) {
          const id = this.grid.cells[y * this.grid.width + x]
          const instance = id ? byId.get(id) : null
          const edges = cellEdgeKeys(x, y)
          const roads = Object.entries(edges).filter(([, key]) => this.grid.roads.has(key)).map(([side]) => side)
          const family = instance ? familyOf(instance.card) : null
          const colors = family ? FAMILIES[family === 'goal' ? 'monument' : family] : null
          const stats = instance
            ? Object.entries(instance.card.stats ?? {}).filter(([, v]) => v).map(([k, v]) => `+${v} ${STAT_SHORT[k] ?? k}`)
            : []
          if (instance?.slots) stats.push(`${instance.slots.used}/${instance.slots.capacity} slots`)
          out.push({
            key: `${x},${y}`, x, y, px: x * this.step, py: y * this.step,
            instance, roads, family, stats,
            monument: instance?.card.type === 'goal',
            color: colors?.color, ink: colors?.ink,
            icon: instance ? ICONS[iconFor(instance.card, family)] : null,
            valid: this.validSet.has(`${x},${y}`)
          })
        }
      }
      return out
    },
    previewIcon () { return ICONS[iconFor(this.previewCard, familyOf(this.previewCard))] },
    ghostStyle () {
      const f = FAMILIES[familyOf(this.previewCard)]
      return {
        left: `${this.cursor.x * this.step}px`, top: `${this.cursor.y * this.step}px`,
        width: `${this.size}px`, height: `${this.size}px`,
        '--c': f.color, '--art-ink': f.ink
      }
    }
  }
}
</script>

<style scoped>
.board { position: relative; }
.cell {
  position: absolute;
  border-radius: 14px;
  background: #182036;
  border: 3px solid #26304c;
  transition: transform 120ms ease, filter 160ms ease, border-color 160ms ease;
}
.board--targeting .cell--invalid { filter: brightness(0.5); }
.cell--valid { border-color: rgba(255,255,255,0.55); background: #1f2a47; }
.cell--cursor { transform: scale(1.06); border-color: #fff; box-shadow: 0 0 0 6px rgba(255,255,255,0.18), 0 18px 40px rgba(0,0,0,0.6); z-index: 2; }
.cell__dot { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; background: rgba(255,255,255,0.35); }

.road { position: absolute; background: var(--road); border-radius: 4px; box-shadow: 0 0 0 2px #0b0e17; }
.road--top { left: -9px; right: -9px; top: -9px; height: 14px; }
.road--bottom { left: -9px; right: -9px; bottom: -9px; height: 14px; }
.road--left { top: -9px; bottom: -9px; left: -9px; width: 14px; }
.road--right { top: -9px; bottom: -9px; right: -9px; width: 14px; }
.road::after { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(90deg, transparent 0 14px, #9aa0ad 14px 24px); opacity: 0.6; border-radius: 4px; }
.road--left::after, .road--right::after { background: repeating-linear-gradient(180deg, transparent 0 14px, #9aa0ad 14px 24px); }

.tile {
  position: absolute; inset: 10px; border-radius: 10px;
  background: var(--c); color: var(--art-ink);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  z-index: 1;
}
.tile svg { width: 46px; height: 46px; fill: var(--art-ink); }
.tile__name { font-size: 17px; font-weight: 800; line-height: 1; text-align: center; padding: 0 6px; }
.tile__stats { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 8px; font-size: 13px; font-weight: 700; opacity: 0.85; }
.tile--monument { box-shadow: inset 0 0 0 4px #fff3c4, 0 0 24px rgba(255,209,102,0.5); }

.ghost {
  position: absolute; z-index: 3; pointer-events: none;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  border-radius: 14px; background: var(--c); color: var(--art-ink); opacity: 0.85;
  font-size: 20px; font-weight: 800;
  animation: ghost 900ms ease-in-out infinite alternate;
}
.ghost svg { width: 46px; height: 46px; fill: var(--art-ink); }
@keyframes ghost { from { opacity: 0.55; } to { opacity: 0.95; } }
</style>
