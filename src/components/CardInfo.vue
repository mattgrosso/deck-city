<template>
  <div v-if="card && keywords.length" class="info">
    <div v-for="[word, text] in keywords" :key="word" class="info__item">
      <div class="info__word">{{ word }}</div>
      <div class="info__text">{{ text }}</div>
    </div>
  </div>
</template>

<script>
import { keywordsFor } from '@/ui/cardText'

export default {
  name: 'CardInfo',
  props: { card: Object, catalog: Object },
  computed: { keywords () { return keywordsFor(this.card, this.catalog).slice(0, 2) } }
}
</script>

<style scoped>
.info { position: absolute; left: 1470px; top: 752px; width: 406px; display: flex; flex-direction: column; gap: 8px; z-index: 5; }
.info__item { background: rgba(0,0,0,0.5); border-left: 6px solid var(--gold); border-radius: 10px; padding: 6px 14px; }
.info__word { font-size: 17px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: var(--gold); }
.info__text { font-size: 18px; color: var(--ink-2); line-height: 1.25; }
</style>
