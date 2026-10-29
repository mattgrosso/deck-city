<template>
  <div class="legend">
    <div v-for="item in items" :key="item.btn + item.label" class="legend__item">
      <span class="btn" :class="`btn--${item.btn.toLowerCase()}`">{{ item.btn }}</span>
      <span>{{ item.label }}</span>
    </div>
    <div class="legend__pad" :class="{ 'legend__pad--on': padConnected }">{{ padConnected ? 'Controller connected' : 'No controller · keyboard works' }}</div>
  </div>
</template>

<script>
export default {
  name: 'ButtonLegend',
  props: { items: { type: Array, required: true }, padConnected: Boolean }
}
</script>

<style scoped>
.legend { position: absolute; left: 0; right: 0; bottom: 0; height: 44px; display: flex; align-items: center; gap: 26px; padding: 0 36px; background: rgba(255,255,255,0.75); border-top: 1px solid var(--line); font-size: 16px; font-weight: 600; color: var(--ink-2); z-index: 20; }
.legend__item { display: flex; align-items: center; gap: 10px; }
.btn { display: inline-grid; place-items: center; min-width: 26px; height: 26px; padding: 0 6px; border-radius: 50%; font-weight: 900; font-size: 14px; color: #000; }
.btn--a { background: #5fd36f; }
.btn--b { background: #ff6b6b; }
.btn--x { background: #5aa9ff; }
.btn--y { background: #ffd93d; }
.btn--lb, .btn--rb, .btn--start, .btn--↔, .btn--✥ { border-radius: 7px; background: #dfe5ee; font-size: 12px; }
.legend__pad { margin-left: auto; font-size: 13px; color: var(--ink-3); }
.legend__pad--on { color: var(--green); }
</style>
