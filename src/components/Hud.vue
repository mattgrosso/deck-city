<template>
  <div class="hud">
    <div class="hud-status">
      <span>Turn {{ turnNumber() }}</span>
      <span>Phase: {{ currentPhaseName() }}</span>
      <span>Treasury: {{ treasury() }}</span>
      <span>Disaster in {{ disasterTurnsRemaining() }} turns</span>
    </div>

    <button class="advance" @click="advance">Next phase &rarr;</button>

    <section>
      <h3>Hand</h3>
      <ul>
        <li v-for="card in hand()" :key="card.id">
          <span>{{ card.name }} <em>(cost {{ card.cost ?? 0 }})</em></span>
          <button :disabled="currentPhaseName() !== 'build'" @click="play(card.id)">Build</button>
        </li>
        <li v-if="hand().length === 0" class="empty">— empty —</li>
      </ul>
    </section>

    <section>
      <h3>City row</h3>
      <ul>
        <li v-for="card in cityRow()" :key="card.id">
          <span>{{ card.name }} <em>(cost {{ card.cost ?? 0 }})</em></span>
          <button :disabled="currentPhaseName() !== 'acquire'" @click="acquire(card.id)">Acquire</button>
        </li>
        <li v-if="cityRow().length === 0" class="empty">— empty —</li>
      </ul>
    </section>

    <section>
      <h3>Built</h3>
      <ul>
        <li v-for="instance in builtStructures()" :key="instance.instanceId">
          {{ instance.card.name }}
          <span v-if="instance.slots">(slots {{ instance.slots.used }}/{{ instance.slots.capacity }})</span>
        </li>
        <li v-if="builtStructures().length === 0" class="empty">— nothing built yet —</li>
      </ul>
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
import { createGame, exampleCards } from '@/game/core'

export default {
  name: 'Hud',
  data () {
    return { game: null }
  },
  created () {
    // Wires up a demo game from the illustrative example cards — not real
    // starter content. See src/game/core/cards/exampleCards.js.
    this.game = createGame({
      cardCatalog: exampleCards.EXAMPLE_CARDS,
      startingDeckCardIds: ['road', 'road', 'residential', 'residential', 'road'],
      cityDeckCardIds: ['clinic'],
      treasury: 10
    })
  },
  methods: {
    // The engine mutates its own plain-object state directly rather than
    // through Vue's reactivity system, so these read live values via
    // methods (not computed/cached properties) and pair with
    // $forceUpdate() after every action to reflect changes.
    turnNumber () { return this.game.turnManager.turnNumber },
    currentPhaseName () {
      const { phases, currentPhaseIndex } = this.game.turnManager
      return phases[currentPhaseIndex].name
    },
    treasury () { return this.game.state.treasury },
    disasterTurnsRemaining () { return this.game.state.disasterTimer.turnsUntilDeadline },
    hand () { return this.game.state.hand },
    cityRow () { return this.game.cityRow.cards },
    builtStructures () { return this.game.state.builtStructures },
    recentLog () { return this.game.log.slice(-8) },

    advance () {
      this.game.actions.advance()
      this.$forceUpdate()
    },
    play (cardId) {
      this.game.actions.playCard(cardId)
      this.$forceUpdate()
    },
    acquire (cardId) {
      this.game.actions.acquireCard(cardId)
      this.$forceUpdate()
    }
  }
}
</script>

<style scoped>
.hud {
  width: 320px;
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

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

li.empty {
  color: #656d7a;
  font-style: italic;
}

em {
  color: #9aa4b2;
  font-style: normal;
}

button {
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.log ul {
  font-size: 12px;
  color: #9aa4b2;
}
</style>
