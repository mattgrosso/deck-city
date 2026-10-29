<template>
  <div
    class="card"
    :class="[`card--${family}`, `card--${size}`, { 'card--focused': focused, 'card--dim': dim, 'card--picked': picked, 'card--cant': cant }]"
    :style="{ '--c': colors.color, '--art-ink': colors.ink }"
  >
    <div v-if="card.type !== 'status' && card.type !== 'disaster' && card.type !== 'goal'" class="card__cost" :class="{ 'card__cost--free': !card.cost }">
      <span>{{ card.cost ?? 0 }}</span>
    </div>
    <div v-if="card.tier" class="card__tier">T{{ card.tier }}</div>
    <div class="card__name">{{ card.name }}</div>
    <div class="card__art">
      <img v-if="hasArt" class="card__pic" :src="`/art/${card.id}.png`" alt="" draggable="false">
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
    cant: Boolean
  },
  computed: {
    family () { return familyOf(this.card) },
    colors () { return FAMILIES[this.family] },
    iconPath () { return ICONS[iconFor(this.card, this.family)] },
    hasArt () { return ART_IDS.includes(this.card.id) },
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
  width: 220px; height: 320px;
  border-radius: 18px;
  background: linear-gradient(180deg, #1c2439 0%, #121828 100%);
  border: 4px solid var(--c);
  box-shadow: 0 10px 30px rgba(0,0,0,0.55);
  color: var(--ink);
  overflow: hidden;
  display: flex; flex-direction: column;
  transition: filter 160ms ease, transform 160ms ease;
}
.card--dim { filter: brightness(0.55) saturate(0.6); }
.card--cant { filter: grayscale(0.7) brightness(0.6); }
.card--picked { border-color: var(--red); }
.card--status, .card--disaster { background: linear-gradient(180deg, #2a1a1f 0%, #190f13 100%); }

.card__cost {
  position: absolute; top: -6px; left: -6px; z-index: 2;
  width: 64px; height: 64px; border-radius: 50%;
  background: var(--gold); color: #2e2000;
  display: grid; place-items: center;
  font-size: 36px; font-weight: 800;
  border: 4px solid #0b0e17;
  box-shadow: 0 6px 14px rgba(0,0,0,0.5);
}
.card__cost--free { background: #e9e9ee; color: #333; }
.card__tier {
  position: absolute; top: 10px; right: 12px; z-index: 2;
  font-size: 22px; font-weight: 800; color: var(--gold);
}
.card--goal .card__name { margin-left: 14px; }
.card__name {
  margin: 14px 12px 0 70px;
  min-height: 60px;
  display: flex; align-items: center;
  font-size: 23px; font-weight: 800; line-height: 1.02;
  letter-spacing: -0.01em;
}
.card__art {
  position: relative;
  margin: 8px 12px 0;
  height: 118px; border-radius: 12px;
  background: radial-gradient(120% 90% at 50% 100%, color-mix(in srgb, var(--c) 55%, #0b0e17) 0%, color-mix(in srgb, var(--c) 22%, #0b0e17) 70%, #0b0e17 100%);
  display: grid; place-items: center;
  overflow: hidden;
  box-shadow: inset 0 0 0 2px rgba(255,255,255,0.08);
}
.card__pic { width: 112%; height: 112%; object-fit: contain; margin-bottom: -8px; filter: drop-shadow(0 10px 10px rgba(0,0,0,0.45)); }
.card__art svg { width: 70px; height: 70px; fill: var(--art-ink); }
.card--status .card__art svg, .card--disaster .card__art svg { fill: #fff; }
.card__type {
  margin: 8px 14px 0;
  font-size: 18px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--c);
}
.card__rules {
  margin: 4px 14px 8px;
  font-size: 17px; line-height: 1.2; font-weight: 500;
  color: var(--ink-2);
  overflow: hidden;
}
.card__rules p { margin: 0 0 4px; }
.card__badge {
  position: absolute; inset: auto 0 0 0; padding: 8px;
  background: var(--red); color: #fff; text-align: center;
  font-weight: 800; font-size: 22px; letter-spacing: 0.1em;
}
.card--focused .card__rules { color: var(--ink); }

.card--market { width: 172px; height: 250px; }
.card--market.card--goal .card__name { margin-left: 14px; margin-right: 44px; }
.card--market .card__name { font-size: 18px; min-height: 44px; margin-left: 56px; margin-top: 8px; }
.card--market .card__cost { width: 52px; height: 52px; font-size: 28px; }
.card--market .card__art { height: 78px; margin-top: 4px; }
.card--market .card__art svg { width: 46px; height: 46px; }
.card--market .card__rules { font-size: 12.5px; line-height: 1.12; margin-top: 2px; }
.card--market .card__type { font-size: 12px; margin-top: 4px; }

.card--pile { width: 200px; height: 290px; }
.card--pile .card__rules { font-size: 17px; }
</style>
