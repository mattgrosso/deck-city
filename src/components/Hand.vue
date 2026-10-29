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
    <div v-if="!hand.length" class="hand__empty">No cards in hand</div>
  </div>
</template>

<script>
import GameCard from './GameCard.vue'
import { fanLayout } from '@/ui/layout'

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
    costOf: { type: Function, default: (c) => c.cost ?? 0 }
  },
  emits: ['focus', 'select'],
  computed: {
    placed () {
      const layout = fanLayout(this.hand.length, this.dim ? null : this.focusedIndex)
      return this.hand.map((card, i) => ({ card, key: this.keys[i], ...layout[i] }))
    }
  }
}
</script>

<style scoped>
.hand {
  position: absolute; left: 880px; top: 812px;
  width: 0; height: 292px;
  transition: filter 200ms ease;
}
.hand--dim { filter: brightness(0.9) saturate(0.7); opacity: 0.8; }
.hand__slot {
  position: absolute; left: -100px; top: 0;
  transition: transform 180ms cubic-bezier(.2,.8,.2,1);
  will-change: transform;
}
.hand__empty {
  position: absolute; left: -200px; top: 120px; width: 400px;
  text-align: center; color: var(--ink-3); font-size: 24px;
}
.deal-enter-from { transform: translate(-900px, -300px) rotate(-30deg) scale(0.6) !important; opacity: 0; }
.deal-leave-to { transform: translate(900px, -200px) rotate(30deg) scale(0.6) !important; opacity: 0; }
.deal-leave-active { position: absolute; transition: all 260ms ease-in; }
.deal-enter-active { transition: all 260ms ease-out; }
</style>
