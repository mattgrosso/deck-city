<template>
  <div class="market" :class="{ 'market--active': active }">
    <div class="market__row">
      <div class="market__head">
        <span>City row</span>
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
    <div class="market__row">
      <div class="market__head">
        <span>Goals <span class="market__sub">· {{ goalsLeft }} more in the deck</span></span>
        <span class="market__note" :class="{ 'market__note--warn': goalExpiresIn === 0 }">
          {{ goalExpiresIn === 0 ? 'Lowest tier expires this turn' : `Lowest tier expires in ${goalExpiresIn} ${goalExpiresIn === 1 ? 'turn' : 'turns'}` }}
        </span>
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
          <div v-if="goalMet(card)" class="market__ready">READY</div>
        </div>
        <div v-if="!goalRow.length" class="market__empty">No goals left</div>
      </div>
    </div>
  </div>
</template>

<script>
import GameCard from './GameCard.vue'

export default {
  name: 'Market',
  components: { GameCard },
  props: {
    cityRow: Array, goalRow: Array, catalog: Object, treasury: Number,
    active: Boolean, focus: Object, goalMet: Function, goalExpiresIn: Number, goalsLeft: Number
  },
  emits: ['focus', 'select'],
  methods: {
    isFocused (row, index) { return this.active && this.focus && this.focus.row === row && this.focus.index === index }
  }
}
</script>

<style scoped>
.market {
  position: absolute; right: 44px; top: 124px; width: 840px;
  display: flex; flex-direction: column; gap: 10px;
  transition: filter 200ms ease, transform 200ms ease;
  filter: brightness(0.6);
}
.market--active { filter: none; }
.market__head { display: flex; justify-content: space-between; align-items: baseline; margin: 0 6px 8px; }
.market__head span:first-child { font-size: 24px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-2); }
.market__note { font-size: 20px; color: var(--ink-3); font-weight: 600; }
.market__note--warn { color: var(--red); }
.market__cards { display: flex; gap: 16px; min-height: 272px; }
.market__slot { position: relative; transition: transform 160ms ease; }
.market__slot:has(.focus-ring) { transform: scale(1.12); z-index: 2; }
.market__sub { font-size: 18px; letter-spacing: 0; text-transform: none; color: var(--ink-3); font-weight: 600; }
.market__ready { position: absolute; left: 50%; bottom: -12px; transform: translateX(-50%); background: var(--green); color: #06261a; font-weight: 800; font-size: 16px; letter-spacing: 0.12em; padding: 4px 12px; border-radius: 999px; }
.market__empty { color: var(--ink-3); font-size: 26px; align-self: center; padding-left: 10px; }
</style>
