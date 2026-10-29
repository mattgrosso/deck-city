<template>
  <div class="pile">
    <div class="pile__tabs">
      <span class="btn-hint">LB</span>
      <button v-for="(tab, i) in tabs" :key="tab.key" class="pile__tab" :class="{ 'pile__tab--on': i === tabIndex }" @click="$emit('tab', i)">
        {{ tab.label }} <span class="pile__count">{{ tab.cards.length }}</span>
      </button>
      <span class="btn-hint">RB</span>
      <span class="pile__close">B / X close</span>
    </div>
    <div class="pile__grid">
      <div v-for="(card, i) in current.cards" :key="i" class="pile__slot" @mouseenter="$emit('focus', i)">
        <GameCard :card="card" :catalog="catalog" size="pile" :class="{ 'focus-ring': i === focusIndex }" />
      </div>
      <div v-if="!current.cards.length" class="pile__empty">Nothing here</div>
    </div>
    <p v-if="current.note" class="pile__note">{{ current.note }}</p>
  </div>
</template>

<script>
import GameCard from './GameCard.vue'

export default {
  name: 'PileView',
  components: { GameCard },
  props: { tabs: Array, tabIndex: Number, focusIndex: Number, catalog: Object },
  emits: ['tab', 'focus'],
  computed: { current () { return this.tabs[this.tabIndex] } }
}
</script>

<style scoped>
.pile { position: absolute; inset: 0; background: rgba(5,7,13,0.92); z-index: 30; padding: 40px 60px 70px; display: flex; flex-direction: column; }
.pile__tabs { display: flex; align-items: center; gap: 18px; margin-bottom: 26px; }
.pile__tab { background: transparent; border: 3px solid var(--line); border-radius: 999px; padding: 10px 26px; font-size: 28px; font-weight: 700; color: var(--ink-2); }
.pile__tab--on { background: var(--ink); color: #0b0e17; border-color: var(--ink); }
.pile__count { opacity: 0.7; margin-left: 8px; }
.btn-hint { font-size: 18px; font-weight: 800; background: #cfd6e6; color: #000; border-radius: 10px; padding: 4px 10px; }
.pile__close { margin-left: auto; color: var(--ink-3); font-size: 22px; font-weight: 600; }
.pile__grid { display: grid; grid-template-columns: repeat(8, 200px); gap: 18px; overflow: hidden; align-content: start; justify-content: center; }
.pile__empty { grid-column: 1 / -1; text-align: center; color: var(--ink-3); font-size: 32px; padding-top: 120px; }
.pile__note { margin: 18px 0 0; text-align: center; color: var(--ink-3); font-size: 20px; }
</style>
