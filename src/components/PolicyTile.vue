<template>
  <div class="ptile" :class="{ 'ptile--on': focused, 'ptile--trade': policy.tradeoff, 'ptile--rare': policy.rare }">
    <div class="ptile__eyebrow">{{ policy.tradeoff ? 'Policy · a trade-off' : policy.rare ? 'Policy · rare' : 'Policy' }}</div>
    <div class="ptile__name">{{ policy.name }}</div>
    <div class="ptile__text">{{ policy.text }}</div>
    <div class="ptile__foot">For the rest of the run</div>
  </div>
</template>

<script>
export default {
  name: 'PolicyTile',
  props: { policy: { type: Object, required: true }, focused: Boolean }
}
</script>

<style scoped>
.ptile { width: 360px; min-height: 250px; display: flex; flex-direction: column; gap: 12px; padding: 22px 24px; border-radius: 18px; background: #fff; border: 2px solid #cfc4f5; border-top: 8px solid #7a5cf0; box-shadow: 0 10px 30px rgba(27,33,48,0.12); transition: transform 160ms ease; }
.ptile--trade { border-top-color: #e08a1e; }
.ptile--rare { border-top-color: #d99a1a; }
.ptile--on { outline: 4px solid var(--focus); outline-offset: 3px; transform: translateY(-6px); }
.ptile__eyebrow { font-size: 13px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #6b55c4; }
.ptile__name { font-size: 32px; font-weight: 800; letter-spacing: -0.01em; color: var(--ink); line-height: 1.05; }
.ptile__text { font-size: 22px; font-weight: 600; color: var(--ink-2); line-height: 1.35; flex: 1; }
.ptile__foot { font-size: 13px; font-weight: 700; color: var(--ink-3); }
</style>
