<template>
  <div class="mandate" :class="{ 'mandate--met': met, 'mandate--focused': focused, 'mandate--big': big }">
    <div class="mandate__head">
      <span class="mandate__era">Era {{ ['I', 'II', 'III'][mandate.era - 1] }} mandate</span>
      <span class="mandate__name">{{ mandate.name }}</span>
      <span v-if="met && !big" class="mandate__ready">MET · call the election</span>
    </div>
    <div v-if="big" class="mandate__flavor">{{ mandate.blurb }}</div>
    <div class="mandate__needs">
      <div v-for="(part, i) in parts" :key="i" class="need" :class="{ 'need--met': part.met }">
        <div class="need__line">
          <span class="need__text">{{ part.label }}</span>
          <span class="need__count">{{ part.atMost ? `${part.current} now` : `${Math.min(part.current, part.target)}/${part.target}` }}</span>
        </div>
        <div class="need__bar"><div class="need__fill" :style="{ width: `${part.pct}%` }" /></div>
      </div>
    </div>
  </div>
</template>

<script>
import { conditionProgress } from '@/game/core'
import { conditionText } from '@/ui/cardText'

// The era's Mandate: what the city must look like when the election comes.
// Fail it and the run is over (Matt: "if you fail the mandate, you lose").
export default {
  name: 'MandateTile',
  props: {
    mandate: { type: Object, required: true },
    state: { type: Object, required: true },
    catalog: { type: Object, required: true },
    tick: { type: Number, default: 0 },
    focused: Boolean,
    big: Boolean
  },
  computed: {
    parts () {
      void this.tick
      return conditionProgress(this.mandate.condition, { state: this.state, catalog: this.catalog }).map(p => {
        const label = conditionText(p.condition, this.catalog)
        const pct = p.atMost ? (p.met ? 100 : Math.max(8, 100 - (p.current - p.target) * 20)) : Math.round(Math.min(1, p.current / Math.max(1, p.target)) * 100)
        return { ...p, label: label.charAt(0).toUpperCase() + label.slice(1), pct }
      })
    },
    met () { return this.parts.length > 0 && this.parts.every(p => p.met) }
  }
}
</script>

<style scoped>
.mandate { padding: 10px 14px 12px; border-radius: 14px; background: #f3f0ff; border: 1.5px solid #b9a8f0; display: flex; flex-direction: column; gap: 7px; transition: transform 160ms ease; }
.mandate--focused { outline: 3px solid var(--focus); outline-offset: 3px; }
.mandate--met { border-color: var(--green); box-shadow: 0 0 0 3px rgba(47,179,106,0.22); }
.mandate__head { display: flex; align-items: baseline; gap: 10px; }
.mandate__era { font-size: 12px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #6b55c4; }
.mandate__name { flex: 1; font-size: 18px; font-weight: 800; color: #2d2163; }
.mandate__ready { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; background: var(--green); color: #fff; padding: 3px 9px; border-radius: 999px; }
.mandate__flavor { font-size: 17px; color: var(--ink-2); font-style: italic; }
.mandate__needs { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 6px 14px; }
.need__line { display: flex; justify-content: space-between; gap: 6px; font-size: 13px; line-height: 1.2; color: var(--ink-2); }
.need__text { flex: 1; }
.need__count { font-weight: 800; color: var(--ink); white-space: nowrap; }
.need--met .need__count { color: #1d7a47; }
.need__bar { height: 6px; margin-top: 3px; border-radius: 999px; background: #e2dcf7; overflow: hidden; }
.need__fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #7a62d9, #9a86ec); transition: width 300ms ease; }
.need--met .need__fill { background: var(--green); }
.mandate--big { width: 520px; padding: 22px 26px 26px; gap: 12px; background: #fff; text-align: left; }
.mandate--big.mandate--focused { transform: scale(1.04); }
.mandate--big .mandate__name { font-size: 34px; }
.mandate--big .mandate__needs { grid-template-columns: 1fr; gap: 10px; }
.mandate--big .need__line { font-size: 19px; }
.mandate--big .need__bar { height: 9px; }
</style>
