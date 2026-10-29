<template>
  <div class="hand" :class="{ 'hand--dim': dim }">
    <transition-group name="deal">
      <div
        v-for="(entry, i) in placed"
        :key="entry.key"
        class="hand__slot"
        :style="{ transform: `translate(${entry.x}px, ${entry.y}px) rotate(${entry.rot}deg) scale(${entry.scale})`, zIndex: entry.z }"
        @mouseenter="$emit('focus', i)"
        @click="$emit('select', i)"
      >
        <GameCard
          :card="entry.card"
          :catalog="catalog"
          :focused="i === focusedIndex"
          :picked="picks.includes(i)"
          :cant="!canPlay(entry.card, i)"
          :cost="costOf(entry.card)"
          :class="{ 'focus-ring': i === focusedIndex && !dim }"
        />
      </div>
    </transition-group>
    <div v-for="g in ghosts" :key="`ghost${g.k}`" class="hand__ghost" :style="{ transform: `translate(${g.x}px, ${g.y}px)` }">Pick a card</div>
    <div v-if="prompt" class="hand__prompt" :style="{ transform: `translate(calc(-50% + ${STAGE_CX}px), ${STAGE_Y - 74}px)` }">
      <span>{{ prompt }}</span>
      <button v-if="ready" type="button" class="hand__confirm" @click.stop="$emit('confirm')"><span class="hand__glyph">{{ confirmGlyph }}</span> Discard these</button>
    </div>
    <div v-if="!hand.length" class="hand__empty">No cards in hand</div>
  </div>
</template>

<script>
import GameCard from './GameCard.vue'
import { fanLayout } from '@/ui/layout'

const STAGE_Y = -430 // the middle of the screen, from the hand's origin
const STAGE_GAP = 250
const STAGE_CX = -275 // centred over the map, clear of the market

export default {
  name: 'Hand',
  components: { GameCard },
  props: {
    hand: { type: Array, required: true },
    keys: { type: Array, required: true }, // stable per-card keys, so the deal animation knows who moved
    catalog: { type: Object, required: true },
    focusedIndex: { type: Number, default: null },
    picks: { type: Array, default: () => [] },
    dim: Boolean,
    canPlay: { type: Function, default: () => true },
    costOf: { type: Function, default: (c) => c.cost ?? 0 },
    // Choosing cards to discard (a civic card): the card being played and the
    // picks lift out of the fan into a row in the middle of the screen, with
    // empty slots for the picks still to make (Matt: "they should get pulled
    // up into the center of the screen so I can see which ones I've selected.
    // That's how Slay the Spire does it.")
    lifted: { type: Number, default: null },
    need: { type: Number, default: 0 },
    prompt: { type: String, default: '' },
    confirmGlyph: { type: String, default: 'Y' }
  },
  emits: ['focus', 'select', 'confirm'],
  data () { return { STAGE_Y, STAGE_CX } },
  computed: {
    staged () { return this.lifted === null ? [] : [this.lifted, ...this.picks] },
    slots () { return this.lifted === null ? 0 : 1 + Math.max(this.need, this.picks.length) },
    ready () { return this.lifted !== null && this.picks.length >= this.need },
    placed () {
      const rest = this.hand.map((_, i) => i).filter(i => !this.staged.includes(i))
      const focusInRest = this.dim ? -1 : rest.indexOf(this.focusedIndex)
      const fan = fanLayout(rest.length, focusInRest === -1 ? null : focusInRest)
      return this.hand.map((card, i) => {
        const k = this.staged.indexOf(i)
        const pos = k === -1 ? fan[rest.indexOf(i)] : { x: this.stageX(k), y: STAGE_Y, rot: 0, scale: i === this.focusedIndex ? 1.06 : 1, z: 60 + k }
        return { card, key: this.keys[i], ...pos }
      })
    },
    ghosts () {
      const out = []
      for (let k = this.staged.length; k < this.slots; k++) out.push({ k, x: this.stageX(k), y: STAGE_Y })
      return out
    }
  },
  methods: {
    stageX (k) { return STAGE_CX + (k - (this.slots - 1) / 2) * STAGE_GAP }
  }
}
</script>

<style scoped>
.hand {
  position: absolute; left: 880px; top: 812px;
  width: 0; height: 292px;
  transition: filter 200ms ease;
}
.hand__slot {
  position: absolute; left: -100px; top: 0;
  transition: transform 180ms cubic-bezier(.2,.8,.2,1);
  will-change: transform;
}
.hand__ghost { position: absolute; left: -100px; top: 0; width: 200px; height: 292px; border-radius: 12px; border: 3px dashed rgba(27,33,48,0.3); background: rgba(255,255,255,0.45); display: grid; place-items: center; color: var(--ink-3); font-size: 18px; font-weight: 700; }
.hand__prompt { position: absolute; left: 0; top: 0; display: flex; align-items: center; gap: 16px; white-space: nowrap; padding: 10px 22px; border-radius: 999px; background: #fff; border: 1.5px solid var(--line); box-shadow: 0 6px 20px rgba(27,33,48,0.15); font-size: 22px; font-weight: 800; color: var(--ink); z-index: 70; }
.hand__confirm { display: inline-flex; align-items: center; gap: 8px; border: 0; border-radius: 999px; padding: 6px 16px; background: var(--red); color: #fff; font: inherit; font-size: 18px; cursor: pointer; }
.hand__glyph { display: inline-grid; place-items: center; min-width: 26px; height: 26px; border-radius: 50%; background: #fff; color: var(--red); font-size: 14px; }
.hand__empty {
  position: absolute; left: -200px; top: 120px; width: 400px;
  text-align: center; color: var(--ink-3); font-size: 24px;
}
.deal-enter-from { transform: translate(-900px, -300px) rotate(-30deg) scale(0.6) !important; opacity: 0; }
.deal-leave-to { transform: translate(900px, -200px) rotate(30deg) scale(0.6) !important; opacity: 0; }
.deal-leave-active { position: absolute; transition: all 260ms ease-in; }
.deal-enter-active { transition: all 260ms ease-out; }
</style>
