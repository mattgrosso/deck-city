<template>
  <div class="info" :class="`info--${tone}`">
    <div class="info__eyebrow">{{ eyebrow }}</div>
    <div class="info__title">{{ title }}</div>
    <p v-for="(line, i) in lines" :key="i" class="info__line">{{ line }}</p>
  </div>
</template>

<script>
// What the cursor is on: a building on the map, or a number in the top
// bar. Matt: "I'd like to be able to get my cursor up to the items in the
// top bar so I can flip between them and get a bit more information."
export default {
  name: 'InfoPanel',
  props: { eyebrow: String, title: String, lines: { type: Array, default: () => [] }, tone: { type: String, default: 'plain' } }
}
</script>

<style scoped>
.info { position: absolute; right: 36px; top: 620px; width: 430px; background: rgba(255,255,255,0.94); border: 1.5px solid var(--line); border-radius: 12px; padding: 12px 16px 10px; box-shadow: 0 10px 30px rgba(27,33,48,0.15); z-index: 6; }
.info--gold { border-color: var(--gold); }
.info__eyebrow { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink-3); font-weight: 800; }
.info__title { font-size: 22px; font-weight: 800; margin: 2px 0 6px; }
.info__line { margin: 0 0 4px; font-size: 15px; line-height: 1.35; color: var(--ink-2); }
</style>
