<template>
  <div class="legend" :class="{ 'legend--touch': touch }">
    <template v-if="touch">
      <!-- On a touchscreen the legend is the toolbar: every action that isn't a direction is a button. -->
      <button v-for="item in items.filter(i => !DIRECTIONAL.includes(i.action))" :key="item.action + item.label" type="button" class="legend__tap" @click.stop="$emit('act', item.action)">{{ item.label }}</button>
      <div class="legend__pad">Tap to pick · tap again to play</div>
    </template>
    <template v-else>
      <div v-for="item in items" :key="item.action + item.label" class="legend__item">
        <span class="btn" :class="[`btn--${item.action}`, `btn--${kind}`]">{{ glyphs[item.action] ?? item.action }}</span>
        <span>{{ item.label }}</span>
      </div>
      <div class="legend__pad" :class="{ 'legend__pad--on': !!pad }">{{ padLine }}</div>
    </template>
  </div>
</template>

<script>
import { GLYPHS } from '@/ui/input'

const NAMES = { xbox: 'Xbox controller', playstation: 'PlayStation controller', switch: 'Switch controller', generic: 'Controller' }

export default {
  name: 'ButtonLegend',
  props: { items: { type: Array, required: true }, pad: { type: String, default: null }, touch: Boolean },
  emits: ['act'],
  data: () => ({ DIRECTIONAL: ['lr', 'dpad', 'left', 'right', 'down'] }),
  computed: {
    kind () { return this.pad ?? 'keyboard' },
    glyphs () { return GLYPHS[this.kind] ?? GLYPHS.generic },
    padLine () { return this.pad ? `${NAMES[this.pad] ?? 'Controller'} connected` : 'No controller · keyboard works' }
  }
}
</script>

<style scoped>
.legend { position: absolute; left: 0; right: 0; bottom: 0; height: 44px; display: flex; align-items: center; gap: 26px; padding: 0 36px; background: rgba(255,255,255,0.75); border-top: 1px solid var(--line); font-size: 16px; font-weight: 600; color: var(--ink-2); z-index: 20; }
.legend__item { display: flex; align-items: center; gap: 8px; }
.legend--touch { height: 76px; gap: 14px; background: rgba(255,255,255,0.92); }
/* Finger-sized at an iPad's scale (the stage shrinks to about 0.6). */
.legend__tap { appearance: none; height: 60px; min-width: 120px; padding: 0 26px; border-radius: 999px; border: 1.5px solid var(--line); background: #fff; font: inherit; font-size: 22px; font-weight: 800; color: var(--ink); cursor: pointer; }
.legend__tap:active { background: #eef2f7; }
.btn { display: inline-grid; place-items: center; min-width: 26px; height: 26px; padding: 0 6px; border-radius: 50%; font-weight: 900; font-size: 14px; color: #000; background: #dfe5ee; }
.btn--select.btn--xbox, .btn--select.btn--generic { background: #5fd36f; }
.btn--back.btn--xbox, .btn--back.btn--generic { background: #ff6b6b; }
.btn--deck.btn--xbox, .btn--deck.btn--generic { background: #5aa9ff; }
.btn--confirm.btn--xbox, .btn--confirm.btn--generic { background: #ffd93d; }
.btn--select.btn--playstation { background: #8fb7ff; }
.btn--back.btn--playstation { background: #ff9c9c; }
.btn--deck.btn--playstation { background: #f5b6e0; }
.btn--confirm.btn--playstation { background: #9fe3c6; }
.btn--switch { background: #e9e9ee; }
.btn--prevPile, .btn--nextPile, .btn--menu, .btn--dpad, .btn--lr, .btn--keyboard { border-radius: 7px; background: #dfe5ee; font-size: 12px; }
.legend__pad { margin-left: auto; font-size: 13px; color: var(--ink-3); }
.legend__pad--on { color: #1d7a47; }
</style>
