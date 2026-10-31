<template>
  <div class="top">
    <div class="top__left">
      <div class="top__title">Deck City</div>
      <div class="top__turn">Turn {{ turn }}</div>
      <div v-if="week" class="top__week">Week {{ week }} of 4</div>
    </div>
    <div class="top__mid">
      <div class="pill pill--big" :class="{ 'focus-ring': focus === 'population' }">
        <svg viewBox="0 0 24 24"><path :d="icons.people" /></svg>
        <span>{{ population }}</span><span class="muted">people</span>
      </div>
      <div class="pill" :class="{ 'focus-ring': focus === 'jobs' }"><svg viewBox="0 0 24 24"><path :d="icons.jobs" /></svg>{{ jobs }} <span class="muted">jobs</span></div>
      <div class="pill" :class="{ 'focus-ring': focus === 'budget' }"><svg viewBox="0 0 24 24"><path :d="icons.coin" /></svg>{{ revenue >= 0 ? `+${revenue}` : `−${-revenue}` }} <span class="muted">a turn</span></div>
      <div class="pill pill--status" v-for="s in statuses" :key="s.name" :class="{ 'pill--zero': !s.count, 'focus-ring': focus === s.name }">
        <svg viewBox="0 0 24 24"><path :d="icons[s.icon]" /></svg>{{ s.count }} <span class="muted">{{ s.name }}</span>
      </div>
    </div>
    <div class="top__right">
      <div v-if="era" class="patience" :class="{ 'patience--low': patienceLow, 'patience--endless': endless, 'focus-ring': focus === 'patience' }">
        <div class="patience__label">
          <span class="patience__era">{{ endless ? 'Endless city' : `Era ${['I', 'II', 'III'][era - 1]}` }}</span>
          <span v-if="!endless">Patience <b>{{ Math.max(0, patience) }}</b><span class="muted"> / {{ patienceStart }}</span><span v-if="lastDrain" class="patience__drain">{{ lastDrain > 0 ? `−${lastDrain}` : `+${-lastDrain}` }} last turn</span></span>
        </div>
        <div v-if="!endless" class="patience__bar"><div class="patience__fill" :style="{ width: `${pct}%` }" /></div>
      </div>
      <div class="pill" :class="{ 'pill--danger': !headedOff && disasterIn <= 1, 'pill--safe': headedOff, 'focus-ring': focus === 'disaster' }">
        <svg viewBox="0 0 24 24"><path :d="icons.clock" /></svg>
        <span v-if="headedOff">Disaster headed off</span>
        <span v-else>Disaster in {{ disasterIn }} {{ disasterIn === 1 ? 'turn' : 'turns' }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { ICONS } from '@/ui/icons'

export default {
  name: 'TopBar',
  props: {
    turn: Number, week: { type: Number, default: 0 }, population: Number, era: { type: Number, default: 0 }, patience: Number, patienceStart: Number, lastDrain: { type: Number, default: 0 }, endless: Boolean, jobs: Number, revenue: Number,
    statuses: Array, disasterIn: Number, headedOff: Boolean, focus: { type: String, default: null }
  },
  data () { return { icons: ICONS } },
  computed: {
    pct () { return Math.max(0, Math.min(100, Math.round(100 * this.patience / Math.max(1, this.patienceStart)))) },
    patienceLow () { return !this.endless && this.pct <= 20 }
  }
}
</script>

<style scoped>
.top { position: absolute; top: 0; left: 0; right: 0; height: 84px; display: flex; align-items: center; padding: 0 36px; gap: 24px; }
.top__left { width: 170px; white-space: nowrap; }
.top__title { font-size: 13px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink-3); }
.top__turn { font-size: 30px; font-weight: 800; line-height: 1; }
.top__week { font-size: 15px; font-weight: 800; color: var(--ink-2, #3a4256); margin-top: 4px; letter-spacing: 0.02em; }
.top__mid { flex: 1; display: flex; gap: 10px; align-items: center; justify-content: center; white-space: nowrap; }
.top__right { display: flex; justify-content: flex-end; align-items: center; gap: 14px; white-space: nowrap; }
.patience { width: 300px; padding: 6px 12px 8px; border-radius: 12px; background: #fff; border: 1.5px solid #b9a8f0; }
.patience__label { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 15px; color: var(--ink-2); }
.patience__label b { font-size: 19px; color: var(--ink); }
.patience__era { font-size: 12px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #6b55c4; }
.patience__drain { margin-left: 8px; font-size: 12px; color: var(--ink-3); }
.patience__bar { height: 8px; margin-top: 5px; border-radius: 999px; background: #e2dcf7; overflow: hidden; }
.patience__fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #7a62d9, #9a86ec); transition: width 400ms ease; }
.patience--low { border-color: var(--red); }
.patience--low .patience__fill { background: var(--red); }
.patience--endless { width: auto; }
.pill--big { font-size: 28px; padding: 6px 18px; border-color: var(--green); }
.pill--big svg { width: 28px; height: 28px; }
.pill--status { border-color: #ecc9cb; }
.pill--zero { opacity: 0.5; }
.pill--danger { border-color: var(--red); color: var(--red); animation: blink 1s steps(2) infinite; }
.pill--safe { border-color: var(--green); color: var(--green); }
@keyframes blink { to { opacity: 0.55; } }
</style>
