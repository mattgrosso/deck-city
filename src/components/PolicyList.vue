<template>
  <!-- The run's policies (core/cards/policies.js), always on show at the left. -->
  <div v-if="policies.length || facilities.length" class="pol">
    <!-- Room left in each facility (Matt, 2026-10-31: "I don't know how full
         they are at a glance"): one bar per kind, every one of that kind summed. -->
    <template v-if="facilities.length">
      <div class="pol__title">Room for bad cards</div>
      <div v-for="f in facilities" :key="f.name" class="fac" :class="{ 'fac--full': f.used >= f.cap }">
        <span class="fac__name">{{ f.name }}</span>
        <span class="fac__bar"><span class="fac__fill" :style="{ width: `${Math.min(100, 100 * f.used / Math.max(1, f.cap))}%` }" /></span>
        <span class="fac__num">{{ f.used >= f.cap ? 'full' : `${f.cap - f.used} left` }}</span>
      </div>
    </template>
    <div v-if="policies.length" class="pol__title">Policies</div>
    <!-- Past two they become name chips, the newest first (Matt, 2026-10-31: "taking up a lot of screen space"). -->
    <template v-if="policies.length <= 2">
      <div v-for="p in policies" :key="p.id" class="pol__item" :class="{ 'pol__item--trade': p.tradeoff }">
        <div class="pol__name">{{ p.name }}</div>
        <div class="pol__text">{{ p.text }}</div>
      </div>
    </template>
    <div v-else class="pol__chips">
      <span v-for="p in [...policies].reverse()" :key="p.id" class="pol__chip" :class="{ 'pol__item--trade': p.tradeoff }">{{ p.name }}</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PolicyList',
  props: { policies: { type: Array, default: () => [] }, facilities: { type: Array, default: () => [] } }
}
</script>

<style scoped>
.pol { position: absolute; left: 36px; bottom: 236px; width: 330px; display: flex; flex-direction: column; gap: 6px; z-index: 6; }
.pol__title { font-size: 12px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #5b3fc4; padding-left: 4px; }
.pol__item { background: #fff; border: 1.5px solid #cfc4f5; border-left: 5px solid #7a5cf0; border-radius: 10px; padding: 6px 10px 7px; box-shadow: 0 2px 8px rgba(27,33,48,0.08); }
.pol__item--trade { border-left-color: #e08a1e; }
.pol__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.pol__chip { background: #fff; border: 1.5px solid #cfc4f5; border-left: 4px solid #7a5cf0; border-radius: 8px; padding: 3px 8px; font-size: 13px; font-weight: 800; color: var(--ink); }
.fac { display: grid; grid-template-columns: 128px 1fr 58px; align-items: center; gap: 8px; background: #fff; border: 1.5px solid var(--line); border-radius: 9px; padding: 4px 10px; font-size: 13px; font-weight: 800; color: var(--ink); }
.fac__bar { height: 8px; border-radius: 4px; background: #e7ebf2; overflow: hidden; }
.fac__fill { display: block; height: 100%; background: #3aa76d; }
.fac--full .fac__fill { background: #e5484d; }
.fac__num { text-align: right; color: var(--ink-2); }
.fac--full .fac__num { color: #c4282d; }
.pol__name { font-size: 15px; font-weight: 800; color: var(--ink); }
.pol__text { font-size: 13px; font-weight: 600; color: var(--ink-2); line-height: 1.3; }
</style>
