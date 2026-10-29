<template>
  <div class="overlay" :class="`overlay--${kind}`">
    <div class="overlay__box">
      <div v-if="eyebrow" class="overlay__eyebrow">{{ eyebrow }}</div>
      <h1 class="overlay__title">{{ title }}</h1>
      <p v-for="(line, i) in lines" :key="i" class="overlay__line">{{ line }}</p>
      <div v-if="items" class="overlay__menu">
        <div v-for="(item, i) in items" :key="item" class="overlay__item" :class="{ 'overlay__item--on': i === index }" @click="$emit('pick', i)">{{ item }}</div>
      </div>
      <div class="overlay__hint"><span class="btn btn--a">{{ glyph }}</span> {{ hint }}</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Overlay',
  props: {
    kind: { type: String, default: 'plain' }, // plain | title | won | lost | summary
    eyebrow: String, title: String, lines: { type: Array, default: () => [] },
    items: Array, index: Number, hint: { type: String, default: 'Continue' }, glyph: { type: String, default: 'A' }
  },
  emits: ['pick']
}
</script>

<style scoped>
.overlay { position: absolute; inset: 0; z-index: 40; display: grid; place-items: center; background: rgba(233,238,245,0.86); backdrop-filter: blur(6px); }
.overlay--title { background: linear-gradient(180deg, #f3f6fb, #dde5ef); }
.overlay__box { text-align: center; max-width: 1100px; padding: 40px; }
.overlay__eyebrow { font-size: 18px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--ink-3); font-weight: 700; margin-bottom: 10px; }
.overlay__title { font-size: 76px; font-weight: 900; margin: 0 0 18px; letter-spacing: -0.02em; line-height: 1; }
.overlay--won .overlay__title { color: var(--green); }
.overlay--lost .overlay__title { color: var(--red); }
.overlay--summary .overlay__title { font-size: 56px; }
.overlay__line { font-size: 24px; margin: 6px 0; color: var(--ink-2); font-weight: 500; }
.overlay__menu { margin: 24px auto 0; display: flex; flex-direction: column; gap: 8px; width: 420px; }
.overlay__item { font-size: 26px; font-weight: 700; padding: 10px 22px; border-radius: 12px; border: 2px solid transparent; color: var(--ink-2); }
.overlay__item--on { border-color: var(--ink); color: var(--ink); background: #fff; }
.overlay__hint { margin-top: 30px; font-size: 20px; color: var(--ink-2); display: flex; align-items: center; justify-content: center; gap: 14px; font-weight: 600; }
.btn { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; font-weight: 900; font-size: 17px; color: #000; }
.btn--a { background: #5fd36f; }
</style>
