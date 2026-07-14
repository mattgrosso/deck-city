<template>
  <div class="hud">
    <div class="hud-status">
      <span>Turn {{ turnNumber() }}</span>
      <span>Phase: {{ currentPhaseName() }}</span>
      <span>Treasury: {{ treasury() }}</span>
      <span>Disaster in {{ disasterTurnsRemaining() }} turns</span>
    </div>

    <button class="advance" @click="$emit('advance')">Next phase &rarr;</button>

    <section>
      <h3>City row</h3>
      <div class="card-row">
        <CardView
          v-for="card in cityRow()"
          :key="card.id"
          :card="card"
          :disabled="currentPhaseName() !== 'acquire'"
          @click="$emit('acquire', card.id)"
        />
        <div v-if="cityRow().length === 0" class="empty">— empty —</div>
      </div>
    </section>

    <section class="log">
      <h3>Log</h3>
      <ul>
        <li v-for="(entry, index) in recentLog()" :key="index">{{ entry }}</li>
      </ul>
    </section>
  </div>
</template>

<script>
import CardView from './CardView.vue'

export default {
  name: 'Hud',
  components: { CardView },
  props: {
    game: { type: Object, required: true },
    // Unused directly, but a changing prop is what makes Vue re-render
    // this component — the engine mutates game.state in place, outside
    // Vue's reactivity, so something has to force a fresh read.
    renderTick: { type: Number, required: true }
  },
  emits: ['advance', 'acquire'],
  methods: {
    // Read live values via methods (not computed/cached properties) so
    // they never go stale between forced re-renders.
    turnNumber () { return this.game.turnManager.turnNumber },
    currentPhaseName () {
      const { phases, currentPhaseIndex } = this.game.turnManager
      return phases[currentPhaseIndex].name
    },
    treasury () { return this.game.state.treasury },
    disasterTurnsRemaining () { return this.game.state.disasterTimer.turnsUntilDeadline },
    cityRow () { return this.game.cityRow.cards },
    recentLog () { return this.game.log.slice(-8) }
  }
}
</script>

<style scoped>
.hud {
  width: 280px;
  flex-shrink: 0;
  height: 100%;
  overflow-y: auto;
  background: #1b1f2a;
  color: #e6e6e6;
  font-size: 14px;
  padding: 16px;
  border-left: 1px solid #2a3040;
}

.hud-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.advance {
  width: 100%;
  margin-bottom: 16px;
  padding: 8px;
  background: #3a6ea5;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.advance:hover {
  background: #4a7eb5;
}

h3 {
  margin: 0 0 6px;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #9aa4b2;
}

section {
  margin-bottom: 16px;
}

.card-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.empty {
  color: #656d7a;
  font-style: italic;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.log ul {
  font-size: 12px;
  color: #9aa4b2;
}
</style>
