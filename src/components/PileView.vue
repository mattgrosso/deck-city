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
.pile { position: absolute; inset: 0; background: rgba(233,238,245,0.96); z-index: 30; padding: 32px 50px 60px; display: flex; flex-direction: column; }
.pile__tabs { display: flex; align-items: center; gap: 18px; margin-bottom: 26px; }
.pile__tab { background: #fff; border: 1.5px solid var(--line); border-radius: 999px; padding: 7px 20px; font-size: 20px; font-weight: 700; color: var(--ink-2); }
.pile__tab--on { background: var(--ink); color: #fff; border-color: var(--ink); }
.pile__count { opacity: 0.7; margin-left: 8px; }
.btn-hint { font-size: 13px; font-weight: 800; background: #dfe5ee; color: #000; border-radius: 7px; padding: 3px 8px; }
.pile__close { margin-left: auto; color: var(--ink-3); font-size: 16px; font-weight: 600; }
.pile__grid { display: grid; grid-template-columns: repeat(9, 180px); gap: 16px; overflow: hidden; align-content: start; justify-content: center; }
.pile__empty { grid-column: 1 / -1; text-align: center; color: var(--ink-3); font-size: 24px; padding-top: 120px; }
.pile__note { margin: 14px 0 0; text-align: center; color: var(--ink-3); font-size: 15px; }
</style>
