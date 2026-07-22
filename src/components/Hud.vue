<template>
  <div class="hud">
    <div class="hud-status">
      <span>Turn {{ turnNumber() }}</span>
      <span>Phase: {{ currentPhaseName() }}</span>
      <span>Treasury: {{ treasury() }}{{ rolloverCap() > 0 ? ` (rollover up to ${rolloverCap()})` : '' }}</span>
      <span>Population: {{ population() }} &middot; Jobs: {{ jobs() }}</span>
      <span :class="{ 'disaster-headed-off': disasterHeadedOff() }">
        {{ disasterHeadedOff() ? 'Disaster risk headed off' : `Disaster in ${disasterTurnsRemaining()} turns` }}
      </span>
    </div>

    <button class="advance" :disabled="gameOver()" @click="$emit('advance')">Next phase &rarr;</button>

    <section>
      <h3>City row</h3>
      <div class="card-row">
        <!--
          Keyed by position, not card.id, same reasoning as HandBar's hand
          cards (see its own comment) — the city row routinely holds 2+
          simultaneous copies of the same facility (see
          cards/facilityCards.js's CITY_DECK_CARDS), and a duplicate v-for
          :key corrupts Vue's list diffing (cards visually "duplicating" or
          going stale on backfill) rather than throwing anything obvious.
        -->
        <CardView
          v-for="(card, index) in cityRow()"
          :key="index"
          :card="card"
          :disabled="currentPhaseName() !== 'acquire' || card.cost > treasury()"
          @click="$emit('acquire', card.id)"
        />
        <div v-if="cityRow().length === 0" class="empty">— empty —</div>
      </div>
    </section>

    <section>
      <h3>Goals</h3>
      <div class="card-row">
        <div v-for="(goal, index) in goalRow()" :key="index" class="goal-card">
          <CardView :card="goal" :disabled="currentPhaseName() !== 'acquire'" />
          <button
            class="claim"
            :disabled="currentPhaseName() !== 'acquire' || !goalConditionMet(goal)"
            @click="$emit('claim-goal', goal.id)"
          >
            Claim
          </button>
        </div>
        <div v-if="goalRow().length === 0" class="empty">— empty —</div>
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
import { evaluateCondition, calcStatTotal } from '@/game/core'

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
  emits: ['advance', 'acquire', 'claim-goal'],
  methods: {
    // Read live values via methods (not computed/cached properties) so
    // they never go stale between forced re-renders.
    turnNumber () { return this.game.turnManager.turnNumber },
    currentPhaseName () {
      const { phases, currentPhaseIndex } = this.game.turnManager
      return phases[currentPhaseIndex].name
    },
    treasury () { return this.game.state.treasury },
    rolloverCap () { return this.game.state.treasuryRolloverCap },
    // calcStatTotal (not a plain reduce over builtStructures) so this
    // reflects adjacency bonuses too, same source of truth the win
    // condition itself uses (see turn/phases.js's checkGameStatus).
    population () { return calcStatTotal(this.game.state, 'population') },
    jobs () { return calcStatTotal(this.game.state, 'jobs') },
    disasterTurnsRemaining () { return this.game.state.disasterTimer.turnsUntilDeadline },
    disasterHeadedOff () { return this.game.state.disasterTimer.headedOff },
    cityRow () { return this.game.cityRow.cards },
    goalRow () { return this.game.goalRow.cards },
    goalConditionMet (goal) {
      return evaluateCondition(goal.condition, { state: this.game.state, catalog: this.game.catalog })
    },
    gameOver () { return this.game.state.gameStatus !== 'playing' },
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

.advance:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.disaster-headed-off {
  color: #2f855a;
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

.goal-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
}

.claim {
  padding: 4px;
  font-size: 12px;
  background: #c9a227;
  color: #1b1f2a;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.claim:hover:not(:disabled) {
  background: #ddb840;
}

.claim:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: #4a5568;
  color: #e6e6e6;
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
