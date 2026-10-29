<template>
  <div class="goal" :class="{ 'goal--ready': ready, 'goal--focused': focused, 'goal--hot': timer <= 1 }">
    <div class="goal__head">
      <span class="goal__name">{{ goal.name }}</span>
      <span class="goal__clock" :class="{ 'goal__clock--hot': timer <= 1, 'goal__clock--warm': timer === 2 }">
        <svg viewBox="0 0 24 24"><path :d="clock" /></svg>{{ timer }}
      </span>
    </div>

    <div class="goal__needs">
      <div v-for="(part, i) in parts" :key="i" class="need" :class="{ 'need--met': part.met }">
        <div class="need__line">
          <span class="need__text">{{ part.label }}</span>
          <span class="need__count">{{ part.atMost ? `${part.current} left` : `${Math.min(part.current, part.target)}/${part.target}` }}</span>
        </div>
        <div class="need__bar"><div class="need__fill" :style="{ width: `${part.pct}%` }" /></div>
      </div>
    </div>

    <div class="goal__reward">
      <div v-for="(line, i) in rewards" :key="i" class="reward">{{ line }}</div>
    </div>

    <div v-if="ready" class="goal__ready">READY · claim</div>
  </div>
</template>

<script>
import { conditionProgress } from '@/game/core'
import { conditionText, effectText } from '@/ui/cardText'
import { ICONS } from '@/ui/icons'

// A goal is an objective, not a card (Matt: "the goals shouldn't look like
// cards... they should make it clear what they require and show what
// progress we have made towards them. Then they can add cards to the deck
// when we buy them"). What it needs, with a bar per requirement; what you
// get; how long it stays on offer.
export default {
  name: 'GoalTile',
  props: {
    goal: { type: Object, required: true },
    state: { type: Object, required: true },
    catalog: { type: Object, required: true },
    timer: { type: Number, default: 0 },
    tick: { type: Number, default: 0 },
    focused: Boolean
  },
  data () { return { clock: ICONS.clock } },
  computed: {
    parts () {
      void this.tick
      return conditionProgress(this.goal.condition, { state: this.state, catalog: this.catalog }).map(p => {
        const label = conditionText(p.condition, this.catalog)
        let pct
        if (p.atMost) pct = p.met ? 100 : Math.max(8, 100 - (p.current - p.target) * 25)
        else pct = Math.round(Math.min(1, p.current / Math.max(1, p.target)) * 100)
        return { ...p, label: label.charAt(0).toUpperCase() + label.slice(1), pct }
      })
    },
    ready () { return this.parts.length > 0 && this.parts.every(p => p.met) },
    rewards () {
      const out = (this.goal.effects?.onComplete ?? []).map(e => {
        const t = effectText(e, this.catalog)
        return t.charAt(0).toUpperCase() + t.slice(1) + ' now'
      })
      const stats = Object.entries(this.goal.stats ?? {}).filter(([, v]) => v).map(([k, v]) => `+${v} ${k}`).join(', ')
      out.push(`A Monument card for your deck${stats ? ` (${stats})` : ''}`)
      return out
    }
  }
}
</script>

<style scoped>
.goal { position: relative; width: 196px; min-height: 206px; display: flex; flex-direction: column; gap: 8px; padding: 10px 11px 12px; border-radius: 12px; background: #fffdf6; border: 1.5px solid #e8d39a; box-shadow: 0 2px 6px rgba(154,101,8,0.08); transition: transform 160ms ease, box-shadow 160ms ease; }
.goal--focused { outline: 3px solid var(--focus); outline-offset: 3px; transform: scale(1.06); z-index: 2; }
.goal--ready { border-color: var(--green); box-shadow: 0 0 0 3px rgba(47,179,106,0.25), 0 4px 14px rgba(47,179,106,0.2); }
.goal__head { display: flex; align-items: flex-start; gap: 6px; }
.goal__name { flex: 1; font-size: 16px; font-weight: 800; line-height: 1.1; color: #5c3d04; }
.goal__clock { display: inline-flex; align-items: center; gap: 3px; font-size: 13px; font-weight: 800; color: #7a5407; background: #fff3d2; border: 1px solid #e8d39a; border-radius: 999px; padding: 1px 7px 1px 4px; }
.goal__clock svg { width: 13px; height: 13px; fill: currentColor; }
.goal__clock--warm { background: #ffe6c2; border-color: #f0a33a; color: #a35e05; }
.goal__clock--hot { background: var(--red); border-color: var(--red); color: #fff; }
.goal__needs { display: flex; flex-direction: column; gap: 6px; }
.need__line { display: flex; justify-content: space-between; gap: 6px; font-size: 12.5px; line-height: 1.2; color: var(--ink-2); }
.need__text { flex: 1; }
.need__count { font-weight: 800; color: var(--ink); white-space: nowrap; }
.need--met .need__count { color: #1d7a47; }
.need__bar { height: 6px; margin-top: 3px; border-radius: 999px; background: #f0e6cb; overflow: hidden; }
.need__fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #e2a92a, #f2b63c); transition: width 300ms ease; }
.need--met .need__fill { background: var(--green); }
.goal__reward { margin-top: auto; padding-top: 7px; border-top: 1px dashed #e8d39a; display: flex; flex-direction: column; gap: 2px; }
.reward { font-size: 11.5px; line-height: 1.25; color: #7a5407; font-weight: 600; }
.reward::before { content: '★ '; color: var(--gold); }
.goal__ready { position: absolute; left: 50%; top: -10px; transform: translateX(-50%); background: var(--green); color: #fff; font-weight: 800; font-size: 11px; letter-spacing: 0.1em; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
</style>
