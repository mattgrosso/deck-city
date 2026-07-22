<template>
  <div class="card-view" :class="{ armed, selected, disabled }" @click="$emit('click')">
    <div class="card-header" :style="{ background: headerColor }">
      <span class="card-name">{{ card.name }}</span>
      <span v-if="card.tier" class="card-tier">T{{ card.tier }}</span>
      <span class="card-cost">{{ card.cost ?? 0 }}</span>
    </div>
    <div class="card-body">
      <span class="card-icon">{{ icon }}</span>
      <p v-if="conditionLine" class="card-condition">{{ conditionLine }}</p>
      <ul v-if="effectLines.length" class="card-effects">
        <li v-for="(line, index) in effectLines" :key="index">{{ line }}</li>
      </ul>
    </div>
  </div>
</template>

<script>
import { colorForCardType, iconForCard } from '@/game/theme'

// Auto-generated, generic effect summary — not hand-authored flavor text.
// Reads directly off the effect descriptor's own fields, so any new effect
// type at least gets a reasonable fallback label without changes here.
function describeEffect (effect) {
  const amount = effect.amount ?? 1
  switch (effect.type) {
    case 'gainTreasury': return `+${amount} gold`
    case 'spendTreasury': return `-${amount} gold`
    case 'gainStatus': return `+${amount} ${effect.card}`
    case 'consumeStatus': return `-${amount} ${effect.card}`
    case 'drawCards': return `draw ${amount}`
    case 'discardCards': return 'discard'
    case 'expandSlots': return `+${amount} slots`
    case 'gainStatusPerAdjacent': return `+${effect.card}/adjacent ${effect.targetTag}`
    case 'headOffDisaster': return 'heads off disaster'
    case 'raiseTreasuryRolloverCap': return `rollover cap → ${effect.amount}`
    default: return effect.type
  }
}

// Same generic, reads-off-the-descriptor approach as describeEffect, for
// goal cards' condition (see game/core/conditions/coreConditions.js for the
// vocabulary this mirrors).
function describeCondition (condition) {
  switch (condition.type) {
    case 'populationAtLeast': return `Population ≥ ${condition.amount}`
    case 'treasuryAtLeast': return `Treasury ≥ ${condition.amount}`
    case 'buildingCountAtLeast': return `${condition.amount}+ ${condition.cardId}`
    case 'statusCountAtMost': return `${condition.tag} ≤ ${condition.amount}`
    case 'adjacentPair': return `${condition.tagA} next to ${condition.tagB}`
    case 'adjacentChain': return `${condition.length} ${condition.tag} in a row`
    case 'all': return condition.conditions.map(describeCondition).join(' AND ')
    case 'any': return condition.conditions.map(describeCondition).join(' OR ')
    default: return condition.type
  }
}

export default {
  name: 'CardView',
  props: {
    card: { type: Object, required: true },
    armed: { type: Boolean, default: false },
    selected: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false }
  },
  emits: ['click'],
  computed: {
    headerColor () { return colorForCardType(this.card.type) },
    icon () { return iconForCard(this.card) },
    conditionLine () { return this.card.condition ? describeCondition(this.card.condition) : null },
    effectLines () {
      if (!this.card.effects) return []
      return Object.entries(this.card.effects).map(
        ([trigger, effects]) => `${trigger}: ${effects.map(describeEffect).join(', ')}`
      )
    }
  }
}
</script>

<style scoped>
.card-view {
  width: 112px;
  height: 156px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #232838;
  border: 2px solid #3a4050;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  color: #e6e6e6;
}

.card-view.armed {
  border-color: #ffffff;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.6);
}

.card-view.selected {
  border-color: #f2a444;
  box-shadow: 0 0 6px rgba(242, 164, 68, 0.6);
}

.card-view.disabled {
  cursor: not-allowed;
  opacity: 0.45;
  pointer-events: none;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 6px;
  font-size: 12px;
  font-weight: 600;
}

.card-cost {
  background: rgba(0, 0, 0, 0.35);
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
}

.card-tier {
  background: rgba(0, 0, 0, 0.35);
  border-radius: 3px;
  padding: 1px 4px;
  font-size: 10px;
}

.card-condition {
  margin: 0;
  font-size: 10px;
  color: #c9a227;
  text-align: center;
}

.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 4px;
  gap: 6px;
  overflow: hidden;
}

.card-icon {
  font-size: 28px;
}

.card-effects {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 10px;
  color: #9aa4b2;
  text-align: center;
}
</style>
