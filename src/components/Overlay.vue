<template>
  <div class="overlay" :class="`overlay--${kind}`">
    <div class="overlay__box">
      <div v-if="eyebrow" class="overlay__eyebrow">{{ eyebrow }}</div>
      <h1 class="overlay__title">{{ title }}</h1>
      <p v-for="(line, i) in lines" :key="i" class="overlay__line">{{ line }}</p>
      <div v-if="items" class="overlay__menu">
        <div v-for="(item, i) in items" :key="item" class="overlay__item" :class="{ 'overlay__item--on': i === index }" @click="$emit('pick', i)">{{ item }}</div>
      </div>
      <div class="overlay__hint"><span class="btn btn--a">A</span> {{ hint }}</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Overlay',
  props: {
    kind: { type: String, default: 'plain' }, // plain | title | won | lost | summary
    eyebrow: String, title: String, lines: { type: Array, default: () => [] },
    items: Array, index: Number, hint: { type: String, default: 'Continue' }
  },
  emits: ['pick']
}
</script>

<style scoped>
.overlay { position: absolute; inset: 0; z-index: 40; display: grid; place-items: center; background: rgba(5,7,13,0.78); }
.overlay--title { background: radial-gradient(900px 600px at 50% 45%, #1b2440 0%, #0b0e17 70%); }
.overlay__box { text-align: center; max-width: 1100px; padding: 40px; }
.overlay__eyebrow { font-size: 26px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--ink-3); font-weight: 700; margin-bottom: 14px; }
.overlay__title { font-size: 96px; font-weight: 900; margin: 0 0 24px; letter-spacing: -0.02em; line-height: 1; }
.overlay--won .overlay__title { color: var(--green); }
.overlay--lost .overlay__title { color: var(--red); }
.overlay--summary .overlay__title { font-size: 72px; }
.overlay__line { font-size: 32px; margin: 8px 0; color: var(--ink-2); font-weight: 500; }
.overlay__menu { margin: 30px auto 0; display: flex; flex-direction: column; gap: 10px; width: 520px; }
.overlay__item { font-size: 36px; font-weight: 700; padding: 14px 28px; border-radius: 16px; border: 4px solid transparent; color: var(--ink-2); }
.overlay__item--on { border-color: #fff; color: #fff; background: rgba(255,255,255,0.08); }
.overlay__hint { margin-top: 40px; font-size: 28px; color: var(--ink-2); display: flex; align-items: center; justify-content: center; gap: 14px; font-weight: 600; }
.btn { display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; font-weight: 900; font-size: 24px; color: #000; }
.btn--a { background: #5fd36f; }
</style>
