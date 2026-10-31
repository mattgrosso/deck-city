<template>
  <div class="market" :class="{ 'market--active': active }">
    <div v-if="mandate" class="market__mandate" @mouseenter="$emit('focus', { row: 2, index: 0 })" @click="$emit('select', { row: 2, index: 0 })">
      <MandateTile :mandate="mandate" :state="state" :catalog="catalog" :tick="tick" :focused="isFocused(2, 0)" />
    </div>
    <div class="market__row market__row--goals">
      <div class="market__head">
        <span class="market__title market__title--gold">Goals <span class="market__sub">· claim one a turn · {{ goalsLeft }} more in the deck</span></span>
        <span class="market__note">Each leaves when its clock runs out</span>
      </div>
      <div class="market__cards">
        <div
          v-for="(card, i) in goalRow"
          :key="`g${i}-${card.id}`"
          class="market__slot"
          @mouseenter="$emit('focus', { row: 1, index: i })"
          @click="$emit('select', { row: 1, index: i })"
        >
          <GoalTile :goal="card" :state="state" :catalog="catalog" :timer="goalTimers[i] ?? 0" :tick="tick" :focused="isFocused(1, i)" />
        </div>
        <div v-if="!goalRow.length" class="market__empty">No goals left</div>
      </div>
    </div>
    <div class="market__row">
      <div class="market__head">
        <span class="market__title">City row
          <span v-if="open" class="market__buys">Open: buy all you can afford</span>
          <span v-else class="market__buys market__buys--none">Opens in week 4 · {{ weeksToGo }} more {{ weeksToGo === 1 ? 'turn' : 'turns' }}</span>
        </span>
        <span v-if="open" class="market__note">The coin plays it; the tag buys it</span>
      </div>
      <!-- Shut until week 4 (Matt, 2026-10-31: "the UI still shows me the
           market every turn, even though I can't buy anything"): only its
           heading shows, so it takes no room and nothing looks for sale. -->
      <div v-if="open" class="market__cards">
        <div
          v-for="(card, i) in cityRow"
          :key="`c${i}`"
          class="market__slot"
          @mouseenter="$emit('focus', { row: 0, index: i })"
          @click="$emit('select', { row: 0, index: i })"
        >
          <GameCard :card="card" :catalog="catalog" size="market" :cost="costOf(card)" :cant="active && (buys < 1 || priceOf(card) > treasury)" :class="{ 'focus-ring': isFocused(0, i) }" />
          <div class="market__price">Buy {{ priceOf(card) }}</div>
        </div>
        <div v-if="!cityRow.length" class="market__empty">Sold out</div>
      </div>
      <!-- Always for sale, as small cards on their own row (row 3): down from the
           city row reaches it (Matt, 2026-10-30: "not obvious that they are cards"). -->
      <div v-if="supply.length || forSale.length" class="market__always">
        <div class="market__always-label">Always for sale</div>
        <div class="market__minis">
          <div
            v-for="(card, j) in supply" :key="`s${j}`" class="mini"
            :style="{ '--c': familyColor(card) }"
            :class="{ 'focus-ring': isFocused(3, j), 'mini--cant': active && (buys < 1 || priceOf(card) > treasury) }"
            @mouseenter="$emit('focus', { row: 3, index: j })"
            @click="$emit('select', { row: 3, index: j })"
          >
            <div class="mini__name">{{ card.name }}</div>
            <div class="mini__price">Buy {{ priceOf(card) }}</div>
          </div>
          <div
            v-for="(item, k) in forSale" :key="`p${k}`" class="mini mini--policy"
            :class="{ 'focus-ring': isFocused(3, supply.length + k), 'mini--cant': active && item.price > treasury }"
            @mouseenter="$emit('focus', { row: 3, index: supply.length + k })"
            @click="$emit('select', { row: 3, index: supply.length + k })"
          >
            <div class="mini__eyebrow">Policy for sale</div>
            <div class="mini__name">{{ item.name }}</div>
            <div class="mini__text">{{ item.policy.text }}</div>
            <div class="mini__price">{{ item.price }} budget</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import GameCard from './GameCard.vue'
import GoalTile from './GoalTile.vue'
import MandateTile from './MandateTile.vue'
import { FAMILIES, familyOf } from '@/ui/cardText'
import { effectiveCost, marketPrice } from '@/game/core'

// The goals sit ABOVE the city row now, in gold, each with its own clock.
// Matt: "I sort of accidentally fulfilled one of the goals... they just look
// like other cards... it would be better if those were emphasized."
export default {
  name: 'Market',
  components: { GameCard, GoalTile, MandateTile },
  props: {
    cityRow: Array, goalRow: Array, goalTimers: { type: Array, default: () => [] }, catalog: Object, treasury: Number,
    state: Object, tick: { type: Number, default: 0 }, buys: { type: Number, default: 1 },
    active: Boolean, focus: Object, goalMet: Function, goalsLeft: Number,
    mandate: { type: Object, default: null }, supply: { type: Array, default: () => [] }, forSale: { type: Array, default: () => [] }
  },
  emits: ['focus', 'select'],
  computed: {
    // The market opens in the last week of each month (core turn/phases.js MONTH).
    open () { void this.tick; return (this.state?.week ?? 1) === 4 },
    weeksToGo () { void this.tick; return 4 - (this.state?.week ?? 1) }
  },
  methods: {
    // tick: the engine mutates state outside Vue, so a bump re-reads the cost.
    costOf (card) { void this.tick; return effectiveCost(this.state, card) },
    priceOf (card) { void this.tick; return marketPrice(this.state, card) },
    familyColor (card) { return FAMILIES[familyOf(card)]?.color ?? '#c98a12' },
    isFocused (row, index) { return this.active && this.focus && this.focus.row === row && this.focus.index === index }
  }
}
</script>

<style scoped>
.market {
  position: absolute; right: 36px; top: 100px; width: 660px;
  display: flex; flex-direction: column; gap: 10px;
}
.market__row--goals { margin-bottom: 8px; padding: 10px 12px 14px; border-radius: 14px; background: linear-gradient(180deg, #fff6dc, #fdf0c9); border: 1.5px solid #e8c56a; box-shadow: 0 6px 20px rgba(217,154,26,0.12); }
.market__head { display: flex; justify-content: space-between; align-items: baseline; margin: 0 4px 6px; }
.market__title { font-size: 16px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-2); }
.market__title--gold { color: #9a6508; }
.market__note { font-size: 13px; color: var(--ink-3); font-weight: 600; }
.market__sub { font-size: 12px; letter-spacing: 0; text-transform: none; color: #a8803a; font-weight: 600; }
.market__cards { display: flex; gap: 12px; min-height: 206px; }
.market__row--goals .market__cards { gap: 10px; padding-top: 4px; min-height: 0; }
.market__slot { position: relative; transition: transform 160ms ease; }
.market__slot:has(.focus-ring) { transform: scale(1.12); z-index: 2; }
/* The city row grows downward, so the focused card never hides the row's title. */
.market__row:not(.market__row--goals) .market__slot { transform-origin: 50% 0; }
.market__timer { position: absolute; left: 50%; bottom: -11px; transform: translateX(-50%); background: #fff; border: 1.5px solid #e2c47a; color: #7a5407; font-weight: 800; font-size: 11px; letter-spacing: 0.06em; padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
.market__timer--warm { border-color: #f0a33a; color: #a35e05; }
.market__timer--hot { background: var(--red); border-color: var(--red); color: #fff; }
.market__ready { position: absolute; left: 50%; top: -10px; transform: translateX(-50%); background: var(--green); color: #fff; font-weight: 800; font-size: 11px; letter-spacing: 0.12em; padding: 3px 10px; border-radius: 999px; }
.market__buys { margin-left: 8px; font-size: 12px; letter-spacing: 0.04em; text-transform: none; background: var(--gold); color: #2e2000; padding: 2px 9px; border-radius: 999px; vertical-align: 2px; }
.market__buys--none { background: #dfe5ee; color: var(--ink-3); }
.market__price { position: absolute; left: 50%; bottom: -11px; transform: translateX(-50%); background: var(--gold); color: #2e2000; border: 1.5px solid #c98a12; font-weight: 800; font-size: 12px; padding: 2px 10px; border-radius: 999px; white-space: nowrap; }
.market__mandate { margin-bottom: 4px; }
.market__supply { cursor: pointer; background: #fff; border: 1.5px solid #c98a12; color: #2e2000; font-weight: 800; font-size: 13px; padding: 3px 12px; border-radius: 999px; white-space: nowrap; }
.mini { position: relative; width: 92px; min-height: 64px; display: flex; flex-direction: column; justify-content: space-between; gap: 4px; padding: 7px 8px 6px; border-radius: 10px; background: #fff; border: 1.5px solid var(--line); border-top: 5px solid var(--c); cursor: pointer; }
.mini__name { font-size: 13px; font-weight: 800; line-height: 1.1; color: var(--ink); }
.mini__price { align-self: flex-start; font-size: 11px; font-weight: 800; padding: 1px 7px; border-radius: 999px; background: var(--gold); color: #2e2000; }
.mini__eyebrow { font-size: 9px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #6b55c4; }
.mini__text { font-size: 11px; font-weight: 600; line-height: 1.25; color: var(--ink-2); }
.mini--policy { width: 168px; border-color: #cfc4f5; border-top-color: #7a5cf0; }
.mini--cant { opacity: 0.6; }
.mini.focus-ring { outline: 3px solid var(--focus); outline-offset: 2px; transform: translateY(-3px); }
.market__minis { display: flex; gap: 8px; align-items: stretch; }
.market__always { display: flex; flex-direction: column; gap: 6px; margin-top: 18px; padding: 8px 10px; border-radius: 14px; background: #fff; border: 1.5px solid var(--line); }
.market__always-label { white-space: nowrap; font-size: 11px; margin-left: 2px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-3); margin-right: 4px; }
.market__always .market__supply { padding: 3px 9px; }
.market__chip-price { display: inline-grid; place-items: center; min-width: 18px; height: 18px; margin-left: 4px; border-radius: 50%; background: var(--gold); color: #2e2000; font-size: 11px; }
.market__dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; vertical-align: 1px; }
.market__supply--policy { border-color: #7a5cf0; color: #3b2a8f; }
.market__supply .muted { color: var(--ink-3); font-weight: 600; }
.market__supply.focus-ring { outline: 3px solid var(--focus); outline-offset: 2px; }
.market__supply--cant { opacity: 0.55; }
.market__empty { color: var(--ink-3); font-size: 20px; align-self: center; padding-left: 10px; }
</style>
