<template>
  <div class="pp" :class="{ 'pp--low': low }">
    <div class="pp__eyebrow">If you build {{ name }} here</div>
    <div class="pp__gain">
      <span v-for="g in gains" :key="g.stat" class="pp__chip" :class="g.amount > 0 ? 'pp__chip--up' : 'pp__chip--down'">
        <b>{{ sign(g.amount) }}</b> {{ g.label }}
      </span>
      <span v-if="!gains.length" class="pp__chip">Nothing</span>
    </div>
    <div v-if="also.length" class="pp__also">Also, when built: {{ also.join('; ') }}.</div>
    <div v-if="verdict" class="pp__verdict" :class="`pp__verdict--${verdict.tone}`">{{ verdict.text }}</div>

    <div class="pp__why">Why</div>
    <div v-for="(row, i) in rows" :key="i" class="pp__row" :class="{ 'pp__row--sub': row.sub }">
      <span class="pp__label">{{ row.label }}</span>
      <span class="pp__amounts">
        <span v-for="a in row.amounts" :key="a.stat" :class="a.amount > 0 ? 'up' : 'down'">{{ sign(a.amount) }} {{ a.short }}</span>
      </span>
    </div>
    <div class="pp__row pp__row--total">
      <span class="pp__label">Your city</span>
      <span class="pp__amounts">
        <span v-for="a in gains" :key="a.stat" :class="a.amount > 0 ? 'up' : 'down'">{{ sign(a.amount) }} {{ a.short }}</span>
      </span>
    </div>
  </div>
</template>

<script>
// What building on the aimed plot does, as a ledger. Matt: "it's showing me
// its work, which I like, but we need to display that in a way that shows
// what it means, and so that in the end, it is clear what I'm actually
// getting and why." The answer first, in big chips; then one line per
// reason, adding up to the total. Lives on the left, off the market.
const ORDER = ['population', 'jobs', 'revenue']
const LABEL = { population: 'people', jobs: 'jobs', revenue: 'revenue a turn' }
const SHORT = { population: 'pop', jobs: 'jobs', revenue: 'rev' }

const amounts = (o) => ORDER.concat(Object.keys(o).filter(k => !ORDER.includes(k)))
  .filter(k => o[k]).map(k => ({ stat: k, amount: o[k], short: SHORT[k] ?? k, label: LABEL[k] ?? k }))

export default {
  name: 'PlacementPreview',
  props: {
    name: String,
    base: { type: Object, default: () => ({}) }, // the card's printed stats
    reasons: { type: Array, default: () => [] }, // { label, stat, amount }
    neighbours: { type: Array, default: () => [] }, // { name, delta }
    own: { type: Object, default: () => ({}) },
    delta: { type: Object, default: () => ({}) },
    also: { type: Array, default: () => [] }, // what it does when built, in words (a Crime card...)
    low: Boolean // the cursor is under the panel's usual spot
  },
  computed: {
    gains () { return amounts(this.delta) },
    rows () {
      const rows = []
      const base = amounts(this.base)
      if (base.length) rows.push({ label: `${this.name} itself`, amounts: base })
      for (const r of this.reasons) rows.push({ label: r.label, amounts: amounts({ [r.stat]: r.amount }), sub: true })
      // Stats never go below zero: whatever the reasons take past that is not taken.
      const sum = { ...this.base }
      for (const r of this.reasons) sum[r.stat] = (sum[r.stat] ?? 0) + r.amount
      const floor = {}
      for (const k of Object.keys(sum)) { const d = (this.own[k] ?? 0) - sum[k]; if (d) floor[k] = d }
      if (Object.keys(floor).length) rows.push({ label: "Can't go below zero", amounts: amounts(floor), sub: true })
      for (const n of this.neighbours) rows.push({ label: `Your ${n.name} next door`, amounts: amounts(n.delta) })
      return rows
    },
    verdict () {
      const score = (o) => (o.population ?? 0) * 1.5 + (o.jobs ?? 0) * 0.5 + (o.revenue ?? 0)
      const here = score(this.delta)
      const plain = score(this.base)
      if (here > plain) return { tone: 'good', text: 'A good spot: better than this building on its own.' }
      if (here < plain) return { tone: 'bad', text: 'A poor spot: worse than this building on its own.' }
      return null
    }
  },
  methods: { sign (n) { return n > 0 ? `+${n}` : `−${Math.abs(n)}` } }
}
</script>

<style scoped>
.pp { position: absolute; left: 36px; top: 130px; width: 400px; background: rgba(255,255,255,0.96); border: 1.5px solid var(--line); border-radius: 14px; padding: 14px 18px 14px; box-shadow: 0 10px 30px rgba(27,33,48,0.15); z-index: 6; transition: top 200ms ease; }
.pp--low { top: 470px; }
.pp__eyebrow { font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-3); font-weight: 800; }
.pp__gain { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 6px; }
.pp__chip { font-size: 22px; font-weight: 700; padding: 4px 12px; border-radius: 999px; background: #eef2f7; color: var(--ink-2); }
.pp__chip b { font-weight: 900; }
.pp__chip--up { background: #dcf3e5; color: #1d7a47; }
.pp__chip--down { background: #fbe1e2; color: #b3262e; }
.pp__also { font-size: 14px; color: #b3262e; font-weight: 700; margin-bottom: 4px; }
.pp__verdict { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
.pp__verdict--good { color: #1d7a47; }
.pp__verdict--bad { color: #b3262e; }
.pp__why { margin: 10px 0 4px; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink-3); font-weight: 800; }
.pp__row { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; font-size: 15px; color: var(--ink); border-top: 1px solid #eef1f5; }
.pp__row--sub .pp__label { padding-left: 14px; color: var(--ink-2); }
.pp__row--sub .pp__label::before { content: '↳ '; color: var(--ink-3); }
.pp__amounts { display: flex; gap: 10px; white-space: nowrap; font-weight: 800; }
.up { color: #1d7a47; }
.down { color: #b3262e; }
.pp__row--total { border-top: 2px solid var(--ink); margin-top: 4px; padding-top: 6px; font-weight: 800; font-size: 16px; }
</style>
