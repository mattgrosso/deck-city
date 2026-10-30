<template>
  <div
    class="card"
    :class="[`card--${family}`, `card--${size}`, { 'card--focused': focused, 'card--dim': dim, 'card--picked': picked, 'card--cant': cant, 'card--dark': isDark }]"
    :style="{ '--c': colors.color, '--c-soft': colors.soft, '--art-ink': colors.ink }"
  >
    <!-- The frame: card stock, a coloured band for the name, a window for
         the picture, the rules below. Cost sits as a coin on the band. -->
    <div class="card__band">
      <div v-if="showCost" class="card__cost" :class="{ 'card__cost--free': !shownCost, 'card__cost--off': shownCost < (card.cost ?? 0) }">{{ shownCost }}</div>
      <div class="card__name">{{ card.name }}</div>
      <div v-if="card.tier" class="card__tier">{{ ['', 'I', 'II', 'III'][card.tier] ?? card.tier }}</div>
    </div>
    <div class="card__window">
      <img v-if="hasArt" class="card__pic" :src="`/art/${artId}.png`" alt="" draggable="false">
      <svg v-else viewBox="0 0 24 24"><path :d="iconPath" /></svg>
    </div>
    <div class="card__type">{{ typeLabel }}</div>
    <div class="card__rules">
      <p v-for="(line, i) in rules" :key="i">{{ line }}</p>
    </div>
    <div v-if="picked" class="card__badge">DISCARD</div>
  </div>
</template>

<script>
import { familyOf, FAMILIES, rulesFor } from '@/ui/cardText'
import { ICONS, iconFor } from '@/ui/icons'
import { ART_IDS } from '@/world/cardArt'

export default {
  name: 'GameCard',
  props: {
    card: { type: Object, required: true },
    catalog: { type: Object, default: () => ({}) },
    size: { type: String, default: 'hand' }, // hand | market | pile
    focused: Boolean,
    dim: Boolean,
    picked: Boolean,
    cant: Boolean,
    // What it costs right now, after discounts (defaults to the printed cost).
    cost: { type: Number, default: null }
  },
  computed: {
    family () { return familyOf(this.card) },
    colors () { return FAMILIES[this.family] },
    isDark () { return this.family === 'status' || this.family === 'disaster' },
    showCost () { return !this.isDark && this.card.type !== 'goal' },
    shownCost () { return this.cost ?? this.card.cost ?? 0 },
    iconPath () { return ICONS[iconFor(this.card, this.family)] },
    artId () { return (this.card.lookAs ?? this.card).id },
    hasArt () { return ART_IDS.includes(this.artId) },
    typeLabel () {
      if (this.card.type === 'goal') return `Goal · Tier ${this.card.tier ?? 1}`
      return this.colors.label
    },
    rules () { return rulesFor(this.card, this.catalog) }
  }
}
</script>

<style scoped>
.card {
  position: relative;
  width: 200px; height: 292px;
  border-radius: 12px;
  background: #fbfaf6;
  border: 1.5px solid #7d8597;
  box-shadow: inset 0 0 0 3px #fff, inset 0 0 0 4px #e3e0d6, 0 6px 18px rgba(27,33,48,0.22);
  color: var(--ink);
  overflow: hidden;
  display: flex; flex-direction: column;
  padding: 7px;
  transition: filter 160ms ease, transform 160ms ease;
}
.card--dim { filter: brightness(0.82) saturate(0.6); }
.card--cant { filter: grayscale(0.7) brightness(0.9); }
.card--picked { border-color: var(--red); }
.card--dark { background: #fbf3f3; border-color: #a85a60; box-shadow: inset 0 0 0 3px #fff, inset 0 0 0 4px #efd9db, 0 6px 18px rgba(27,33,48,0.22); }

.card__band {
  position: relative;
  display: flex; align-items: center; gap: 6px;
  min-height: 44px;
  padding: 4px 8px 4px 8px;
  border-radius: 7px;
  background: var(--c-soft);
  border: 1px solid color-mix(in srgb, var(--c) 55%, #fff);
}
.card--dark .card__band { background: var(--c-soft); border-color: color-mix(in srgb, var(--c) 55%, #fff); }
.card__cost {
  flex: none;
  width: 34px; height: 34px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ffe08a, var(--gold) 60%, #c98a12);
  color: #2e2000; display: grid; place-items: center;
  font-size: 19px; font-weight: 800;
  box-shadow: 0 1px 0 #fff inset, 0 2px 4px rgba(0,0,0,0.25);
}
.card__cost--free { background: #f1f1f1; color: #555; }
.card__cost--off { background: radial-gradient(circle at 35% 30%, #c6f7d8, #2fb36a 60%, #1d7a47); color: #fff; }
.card__name { flex: 1; font-size: 18px; font-weight: 800; line-height: 1.02; letter-spacing: -0.01em; }
.card__tier { font-size: 13px; font-weight: 800; letter-spacing: 0.1em; color: color-mix(in srgb, var(--c) 70%, #000); }

.card__window {
  position: relative;
  margin: 6px 0 0;
  height: 112px; border-radius: 7px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--c-soft) 70%, #fff) 0%, color-mix(in srgb, var(--c-soft) 45%, #d8e4f0) 100%);
  border: 1px solid #d9d6cc;
  box-shadow: inset 0 2px 6px rgba(0,0,0,0.12);
  display: grid; place-items: center;
  overflow: hidden;
}
.card--dark .card__window { background: linear-gradient(180deg, #e9e4e6 0%, #cfc8cc 100%); border-color: #d4c3c6; }
.card__window svg { width: 56px; height: 56px; fill: var(--c); }
.card__pic { width: 110%; height: 110%; object-fit: contain; margin-bottom: -6px; filter: drop-shadow(0 6px 6px rgba(0,0,0,0.3)); }

.card__type {
  margin: 6px 2px 0;
  font-size: 11.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;
  color: color-mix(in srgb, var(--c) 70%, #000);
}
.card__rules {
  margin: 3px 2px 0;
  font-size: 13.5px; line-height: 1.22; font-weight: 500;
  color: var(--ink-2);
  overflow: hidden;
}
.card__rules p { margin: 0 0 3px; }
.card__badge {
  position: absolute; inset: auto 0 0 0; padding: 5px;
  background: var(--red); color: #fff; text-align: center;
  font-weight: 800; font-size: 15px; letter-spacing: 0.1em;
}
.card--focused .card__rules { color: var(--ink); }

.card--market { width: 150px; height: 222px; padding: 5px; }
.card--market .card__band { min-height: 36px; padding: 3px 6px; }
.card--market .card__cost { width: 28px; height: 28px; font-size: 15px; }
.card--market .card__name { font-size: 14px; }
.card--market .card__window { height: 78px; margin-top: 4px; }
.card--market .card__window svg { width: 40px; height: 40px; }
.card--market .card__type { font-size: 9.5px; margin-top: 4px; }
.card--market .card__rules { font-size: 10.5px; line-height: 1.15; margin-top: 2px; }
.card--market .card__tier { font-size: 11px; }

.card--pile { width: 180px; height: 262px; }
.card--pile .card__rules { font-size: 13px; }
</style>
