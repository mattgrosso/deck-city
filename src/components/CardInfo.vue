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
  computed: { keywords () { return keywordsFor(this.card, this.catalog).slice(0, 1) } }
}
</script>

<style scoped>
.info { position: absolute; left: 36px; top: 330px; width: 384px; display: flex; flex-direction: column; gap: 8px; z-index: 5; }
.info__item { background: rgba(255,255,255,0.85); border-left: 4px solid var(--gold); border: 1px solid var(--line); border-left-width: 4px; border-left-color: var(--gold); border-radius: 8px; padding: 6px 12px; }
.info__word { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #b47a0a; }
.info__text { font-size: 14px; color: var(--ink-2); line-height: 1.3; }
</style>
