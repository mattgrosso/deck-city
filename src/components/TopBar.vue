<template>
  <div class="top">
    <div class="top__left">
      <div class="top__title">Deck City</div>
      <div class="top__turn">Turn {{ turn }}</div>
    </div>
    <div class="top__mid">
      <div class="pill pill--big" :class="{ 'pill--win': population >= populationTarget, 'focus-ring': focus === 'population' }">
        <svg viewBox="0 0 24 24"><path :d="icons.people" /></svg>
        <span>{{ population }}</span><span class="muted">/ {{ populationTarget }}</span>
      </div>
      <div class="pill" :class="{ 'focus-ring': focus === 'jobs' }"><svg viewBox="0 0 24 24"><path :d="icons.jobs" /></svg>{{ jobs }} <span class="muted">jobs</span></div>
      <div class="pill" :class="{ 'focus-ring': focus === 'budget' }"><svg viewBox="0 0 24 24"><path :d="icons.coin" /></svg>{{ revenue }} <span class="muted">next budget</span></div>
      <div class="pill pill--status" v-for="s in statuses" :key="s.name" :class="{ 'pill--zero': !s.count, 'focus-ring': focus === s.name }">
        <svg viewBox="0 0 24 24"><path :d="icons[s.icon]" /></svg>{{ s.count }} <span class="muted">{{ s.name }}</span>
      </div>
    </div>
    <div class="top__right">
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
    turn: Number, population: Number, populationTarget: Number, jobs: Number, revenue: Number,
    statuses: Array, disasterIn: Number, headedOff: Boolean, focus: { type: String, default: null }
  },
  data () { return { icons: ICONS } }
}
</script>

<style scoped>
.top { position: absolute; top: 0; left: 0; right: 0; height: 84px; display: flex; align-items: center; padding: 0 36px; gap: 24px; }
.top__left { width: 170px; white-space: nowrap; }
.top__title { font-size: 13px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink-3); }
.top__turn { font-size: 30px; font-weight: 800; line-height: 1; }
.top__mid { flex: 1; display: flex; gap: 10px; align-items: center; justify-content: center; white-space: nowrap; }
.top__right { display: flex; justify-content: flex-end; white-space: nowrap; }
.pill--big { font-size: 28px; padding: 6px 18px; border-color: var(--green); }
.pill--big svg { width: 28px; height: 28px; }
.pill--win { background: var(--green); color: #06261a; }
.pill--win .muted { color: #06261a; }
.pill--status { border-color: #ecc9cb; }
.pill--zero { opacity: 0.5; }
.pill--danger { border-color: var(--red); color: var(--red); animation: blink 1s steps(2) infinite; }
.pill--safe { border-color: var(--green); color: var(--green); }
@keyframes blink { to { opacity: 0.55; } }
</style>
