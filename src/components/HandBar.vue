<template>
  <div class="hand-bar">
    <CardView
      v-for="(card, index) in hand()"
      :key="index"
      :card="card"
      :armed="index === armedIndex || index === civicSelectionCardIndex"
      :selected="isMarkedForDiscard(index)"
      :disabled="!isBuildPhase()"
      @click="onCardClick(index)"
    />
    <div v-if="hand().length === 0" class="empty">Hand is empty</div>
  </div>
</template>

<script>
import CardView from './CardView.vue'

export default {
  name: 'HandBar',
  components: { CardView },
  props: {
    game: { type: Object, required: true },
    armedIndex: { type: Number, default: null },
    // { cardIndex, discardIndices } while a civic card's "pick 2 to
    // discard" selection is in progress, otherwise null. Indices, not card
    // ids, for the same reason armedIndex is an index — duplicate cards
    // in hand share an id, so id-based tracking would mark all of them.
    civicSelection: { type: Object, default: null },
    // Unused directly, but a changing prop is what makes Vue re-render
    // this component — the engine mutates game.state in place, outside
    // Vue's reactivity, so something has to force a fresh read.
    renderTick: { type: Number, required: true }
  },
  emits: ['arm', 'toggle-discard', 'cancel-civic'],
  computed: {
    civicSelectionCardIndex () { return this.civicSelection?.cardIndex ?? null }
  },
  methods: {
    hand () { return this.game.state.hand },
    isBuildPhase () {
      const { phases, currentPhaseIndex } = this.game.turnManager
      return phases[currentPhaseIndex].name === 'build'
    },
    isMarkedForDiscard (index) {
      return this.civicSelection?.discardIndices.includes(index) ?? false
    },
    onCardClick (index) {
      if (this.civicSelection) {
        if (index === this.civicSelection.cardIndex) {
          this.$emit('cancel-civic')
        } else {
          this.$emit('toggle-discard', index)
        }
        return
      }
      this.$emit('arm', index)
    }
  }
}
</script>

<style scoped>
.hand-bar {
  flex-shrink: 0;
  display: flex;
  gap: 10px;
  padding: 12px;
  background: #1b1f2a;
  border-top: 1px solid #2a3040;
  overflow-x: auto;
}

.empty {
  color: #656d7a;
  font-style: italic;
  padding: 12px;
}
</style>
