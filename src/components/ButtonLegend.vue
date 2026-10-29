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
.legend { position: absolute; left: 0; right: 0; bottom: 0; height: 54px; display: flex; align-items: center; gap: 34px; padding: 0 44px; background: rgba(0,0,0,0.45); font-size: 22px; font-weight: 600; color: var(--ink-2); z-index: 20; }
.legend__item { display: flex; align-items: center; gap: 10px; }
.btn { display: inline-grid; place-items: center; min-width: 36px; height: 36px; padding: 0 8px; border-radius: 50%; font-weight: 900; font-size: 20px; color: #000; }
.btn--a { background: #5fd36f; }
.btn--b { background: #ff6b6b; }
.btn--x { background: #5aa9ff; }
.btn--y { background: #ffd93d; }
.btn--lb, .btn--rb, .btn--start, .btn--↔, .btn--✥ { border-radius: 10px; background: #cfd6e6; font-size: 16px; }
.legend__pad { margin-left: auto; font-size: 18px; color: var(--ink-3); }
.legend__pad--on { color: var(--green); }
</style>
