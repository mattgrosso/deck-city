<template>
  <!-- The overnight report as a ledger (Matt, 2026-10-30: "it's just like a
       block of text... formatting that adds up the various pieces"), the
       same shape as the placement preview: each piece on its own line, the
       total underneath. -->
  <div class="sum">
    <div class="sum__box">
      <div class="sum__eyebrow">Overnight · turn {{ turn }}</div>

      <div class="sum__cols">
        <section class="sum__block sum__block--click" @click.stop="$emit('toggle')">
          <div class="sum__head"><span>Budget this turn</span><b class="sum__big">{{ budget.total }}</b></div>
          <div v-for="([label, n], i) in budget.parts" :key="i" class="sum__row">
            <span>{{ label }}</span><b :class="n < 0 ? 'neg' : 'pos'">{{ n > 0 ? '+' : '−' }}{{ Math.abs(n) }}</b>
          </div>
          <div v-if="!budget.parts.length" class="sum__row sum__row--dim"><span>Nothing came in</span><b>0</b></div>
          <!-- Every building, what it earned and what it cost to run (Matt,
               2026-10-31: "exactly what buildings cost me in upkeep and what
               revenue they gave me"): off until asked for. -->
          <template v-if="detail">
            <div class="sum__sub">By building <span>earned · upkeep</span></div>
            <div v-for="b in byBuilding" :key="b.name" class="sum__row sum__row--small">
              <span>{{ b.count > 1 ? `${b.count} × ` : '' }}{{ b.name }}</span><b><span class="pos">+{{ b.revenue }}</span> · <span :class="b.upkeep ? 'neg' : ''">{{ b.upkeep ? `−${b.upkeep}` : '0' }}</span></b>
            </div>
          </template>
          <div class="sum__more">{{ detail ? 'Hide' : 'Show' }} each building <span class="btn btn--small">{{ detailGlyph }}</span></div>
        </section>

        <section v-if="drain" class="sum__block">
          <div class="sum__head"><span>Patience</span><b class="sum__big" :class="drain.total > 0 ? 'neg' : 'pos'">{{ drain.total > 0 ? '−' : '+' }}{{ Math.abs(drain.total) }}</b></div>
          <div v-for="([label, n], i) in drain.parts" :key="i" class="sum__row">
            <span>{{ cap(label) }}</span><b :class="n > 0 ? 'neg' : 'pos'">{{ n > 0 ? '−' : '+' }}{{ Math.abs(n) }}</b>
          </div>
          <div class="sum__row sum__row--total"><span>Left this era</span><b>{{ Math.max(0, patience) }} / {{ patienceStart }}</b></div>
        </section>
      </div>

      <!-- How things are going, turn by turn (Matt: "some line graphs... that
           show crime or pollution or other statuses over time"). -->
      <section v-if="history.length > 1" class="sum__block sum__graphs">
        <div v-for="g in graphs" :key="g.key" class="graph">
          <div class="graph__label">{{ g.label }} <b>{{ g.last }}</b></div>
          <svg viewBox="0 0 200 50" preserveAspectRatio="none" class="graph__svg"><polyline :points="g.points" :stroke="g.colour" fill="none" stroke-width="3" stroke-linejoin="round" vector-effect="non-scaling-stroke" /></svg>
        </div>
      </section>

      <section v-if="events.length" class="sum__block sum__events">
        <div class="sum__head"><span>What happened</span></div>
        <div v-for="(e, i) in events" :key="i" class="sum__event" :class="{ 'sum__event--bad': e.bad }">{{ e.text }}</div>
      </section>

      <div class="sum__hint"><span class="btn">{{ glyph }}</span> Continue</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SummaryPanel',
  props: {
    turn: Number,
    budget: { type: Object, default: () => ({ total: 0, parts: [] }) },
    drain: { type: Object, default: null },
    patience: { type: Number, default: 0 },
    patienceStart: { type: Number, default: 0 },
    events: { type: Array, default: () => [] },
    glyph: { type: String, default: 'A' },
    detail: Boolean,
    detailGlyph: { type: String, default: 'Tab' },
    byBuilding: { type: Array, default: () => [] },
    history: { type: Array, default: () => [] }
  },
  emits: ['toggle'],
  computed: {
    graphs () {
      const h = this.history.slice(-30)
      const line = (key) => {
        const vals = h.map(x => x[key] ?? 0)
        const max = Math.max(1, ...vals)
        return vals.map((v, i) => `${(i / Math.max(1, vals.length - 1)) * 200},${48 - (v / max) * 44}`).join(' ')
      }
      return [
        { key: 'crime', label: 'Crime', colour: '#e5484d' },
        { key: 'trash', label: 'Trash', colour: '#8a6a3a' },
        { key: 'pollution', label: 'Pollution', colour: '#6b7280' },
        { key: 'budget', label: 'Budget', colour: '#c98a12' },
        { key: 'population', label: 'People', colour: '#3aa76d' }
      ].map(g => ({ ...g, points: line(g.key), last: h[h.length - 1]?.[g.key] ?? 0 }))
    }
  },
  methods: { cap: (s) => s.charAt(0).toUpperCase() + s.slice(1) }
}
</script>

<style scoped>
.sum { position: absolute; inset: 0; z-index: 40; display: grid; place-items: center; background: rgba(233,238,245,0.86); backdrop-filter: blur(6px); }
.sum__box { width: 1080px; max-height: 1020px; overflow-y: auto; display: flex; flex-direction: column; gap: 22px; }
.sum__eyebrow { font-size: 18px; letter-spacing: 0.3em; text-transform: uppercase; font-weight: 800; color: var(--ink-3); text-align: center; }
.sum__cols { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; align-items: start; }
.sum__block { background: #fff; border: 1.5px solid var(--line); border-radius: 18px; padding: 18px 24px; box-shadow: 0 8px 26px rgba(27,33,48,0.08); }
.sum__head { display: flex; justify-content: space-between; align-items: baseline; font-size: 15px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-2); padding-bottom: 10px; border-bottom: 1.5px solid var(--line); margin-bottom: 6px; }
.sum__big { font-size: 40px; letter-spacing: 0; color: var(--ink); }
.sum__row { display: flex; justify-content: space-between; font-size: 20px; font-weight: 600; color: var(--ink-2); padding: 5px 0; }
.sum__row b { font-weight: 800; }
.sum__row--dim { color: var(--ink-3); }
.sum__row--total { border-top: 1.5px dashed var(--line); margin-top: 6px; padding-top: 10px; color: var(--ink); }
.pos { color: #1d7a47; }
.neg { color: var(--red); }
.sum__block--click { cursor: pointer; }
.sum__sub { display: flex; justify-content: space-between; margin-top: 12px; padding-top: 8px; border-top: 1.5px dashed var(--line); font-size: 13px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3); }
.sum__row--small { font-size: 16px; padding: 2px 0; }
.sum__more { margin-top: 8px; font-size: 14px; font-weight: 700; color: var(--ink-3); text-align: right; }
.btn--small { min-width: 24px; height: 24px; font-size: 12px; border-radius: 6px; background: #e7ebf2; margin: 0 0 0 6px; }
.sum__graphs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 18px; padding: 14px 20px; }
.graph__label { font-size: 14px; font-weight: 800; color: var(--ink-2); display: flex; justify-content: space-between; }
.graph__svg { width: 100%; height: 50px; }
.sum__events { display: flex; flex-direction: column; gap: 6px; }
.sum__event { font-size: 19px; font-weight: 600; color: var(--ink-2); padding: 6px 0 6px 14px; border-left: 4px solid var(--line); }
.sum__event--bad { color: var(--red); border-left-color: var(--red); font-weight: 700; }
.sum__hint { text-align: center; font-size: 18px; font-weight: 700; color: var(--ink-2); }
.btn { display: inline-grid; place-items: center; min-width: 30px; height: 30px; padding: 0 6px; border-radius: 50%; background: #5fd36f; color: #000; font-weight: 900; margin-right: 6px; }
</style>
