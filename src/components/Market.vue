<template>
  <div class="market" :class="{ 'market--active': active }">
    <div class="market__row market__row--goals">
      <div class="market__head">
        <span class="market__title market__title--gold">Goals <span class="market__sub">· claim one a turn · {{ goalsLeft }} more in the deck</span></span>
        <span class="market__note">Lose when the deck runs out</span>
      </div>
      <div class="market__cards">
        <div
          v-for="(card, i) in goalRow"
          :key="`g${i}`"
          class="market__slot"
          :class="{ 'market__slot--ready': goalMet(card) }"
          @mouseenter="$emit('focus', { row: 1, index: i })"
          @click="$emit('select', { row: 1, index: i })"
        >
          <GameCard :card="card" :catalog="catalog" size="market" :cant="!goalMet(card)" :class="{ 'focus-ring': isFocused(1, i) }" />
          <div class="market__timer" :class="{ 'market__timer--hot': (goalTimers[i] ?? 9) <= 1, 'market__timer--warm': (goalTimers[i] ?? 9) === 2 }">
            {{ goalTimers[i] ?? '–' }} {{ goalTimers[i] === 1 ? 'turn' : 'turns' }} left
          </div>
          <div v-if="goalMet(card)" class="market__ready">READY</div>
        </div>
        <div v-if="!goalRow.length" class="market__empty">No goals left</div>
      </div>
    </div>
    <div class="market__row">
      <div class="market__head">
        <span class="market__title">City row</span>
        <span class="market__note">Buy with budget</span>
      </div>
      <div class="market__cards">
        <div
          v-for="(card, i) in cityRow"
          :key="`c${i}`"
          class="market__slot"
          @mouseenter="$emit('focus', { row: 0, index: i })"
          @click="$emit('select', { row: 0, index: i })"
        >
          <GameCard :card="card" :catalog="catalog" size="market" :cant="active && card.cost > treasury" :class="{ 'focus-ring': isFocused(0, i) }" />
        </div>
        <div v-if="!cityRow.length" class="market__empty">Sold out</div>
      </div>
    </div>
  </div>
</template>

<script>
import GameCard from './GameCard.vue'

// The goals sit ABOVE the city row now, in gold, each with its own clock.
// Matt: "I sort of accidentally fulfilled one of the goals... they just look
// like other cards... it would be better if those were emphasized."
export default {
  name: 'Market',
  components: { GameCard },
  props: {
    cityRow: Array, goalRow: Array, goalTimers: { type: Array, default: () => [] }, catalog: Object, treasury: Number,
    active: Boolean, focus: Object, goalMet: Function, goalsLeft: Number
  },
  emits: ['focus', 'select'],
  methods: {
    isFocused (row, index) { return this.active && this.focus && this.focus.row === row && this.focus.index === index }
  }
}
</script>

<style scoped>
.market {
  position: absolute; right: 36px; top: 100px; width: 660px;
  display: flex; flex-direction: column; gap: 10px;
  transition: filter 200ms ease, opacity 200ms ease;
  opacity: 0.72; filter: saturate(0.7);
}
.market--active { opacity: 1; filter: none; }
.market__row--goals { margin-bottom: 8px; padding: 10px 12px 14px; border-radius: 14px; background: linear-gradient(180deg, #fff6dc, #fdf0c9); border: 1.5px solid #e8c56a; box-shadow: 0 6px 20px rgba(217,154,26,0.12); }
.market__head { display: flex; justify-content: space-between; align-items: baseline; margin: 0 4px 6px; }
.market__title { font-size: 16px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-2); }
.market__title--gold { color: #9a6508; }
.market__note { font-size: 13px; color: var(--ink-3); font-weight: 600; }
.market__sub { font-size: 12px; letter-spacing: 0; text-transform: none; color: #a8803a; font-weight: 600; }
.market__cards { display: flex; gap: 12px; min-height: 222px; }
.market__slot { position: relative; transition: transform 160ms ease; }
.market__slot:has(.focus-ring) { transform: scale(1.12); z-index: 2; }
.market__timer { position: absolute; left: 50%; bottom: -11px; transform: translateX(-50%); background: #fff; border: 1.5px solid #e2c47a; color: #7a5407; font-weight: 800; font-size: 11px; letter-spacing: 0.06em; padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
.market__timer--warm { border-color: #f0a33a; color: #a35e05; }
.market__timer--hot { background: var(--red); border-color: var(--red); color: #fff; }
.market__ready { position: absolute; left: 50%; top: -10px; transform: translateX(-50%); background: var(--green); color: #fff; font-weight: 800; font-size: 11px; letter-spacing: 0.12em; padding: 3px 10px; border-radius: 999px; }
.market__empty { color: var(--ink-3); font-size: 20px; align-self: center; padding-left: 10px; }
</style>
