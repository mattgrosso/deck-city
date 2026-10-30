<template>
  <!-- The overnight report as a ledger (Matt, 2026-10-30: "it's just like a
       block of text... formatting that adds up the various pieces"), the
       same shape as the placement preview: each piece on its own line, the
       total underneath. -->
  <div class="sum">
    <div class="sum__box">
      <div class="sum__eyebrow">Overnight · turn {{ turn }}</div>

      <div class="sum__cols">
        <section class="sum__block">
          <div class="sum__head"><span>Budget this turn</span><b class="sum__big">{{ budget.total }}</b></div>
          <div v-for="([label, n], i) in budget.parts" :key="i" class="sum__row">
            <span>{{ label }}</span><b :class="n < 0 ? 'neg' : 'pos'">{{ n > 0 ? '+' : '−' }}{{ Math.abs(n) }}</b>
          </div>
          <div v-if="!budget.parts.length" class="sum__row sum__row--dim"><span>Nothing came in</span><b>0</b></div>
        </section>

        <section v-if="drain" class="sum__block">
          <div class="sum__head"><span>Patience</span><b class="sum__big" :class="drain.total > 0 ? 'neg' : 'pos'">{{ drain.total > 0 ? '−' : '+' }}{{ Math.abs(drain.total) }}</b></div>
          <div v-for="([label, n], i) in drain.parts" :key="i" class="sum__row">
            <span>{{ cap(label) }}</span><b :class="n > 0 ? 'neg' : 'pos'">{{ n > 0 ? '−' : '+' }}{{ Math.abs(n) }}</b>
          </div>
          <div class="sum__row sum__row--total"><span>Left this era</span><b>{{ Math.max(0, patience) }} / {{ patienceStart }}</b></div>
        </section>
      </div>

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
    glyph: { type: String, default: 'A' }
  },
  methods: { cap: (s) => s.charAt(0).toUpperCase() + s.slice(1) }
}
</script>

<style scoped>
.sum { position: absolute; inset: 0; z-index: 40; display: grid; place-items: center; background: rgba(233,238,245,0.86); backdrop-filter: blur(6px); }
.sum__box { width: 1080px; display: flex; flex-direction: column; gap: 22px; }
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
.sum__events { display: flex; flex-direction: column; gap: 6px; }
.sum__event { font-size: 19px; font-weight: 600; color: var(--ink-2); padding: 6px 0 6px 14px; border-left: 4px solid var(--line); }
.sum__event--bad { color: var(--red); border-left-color: var(--red); font-weight: 700; }
.sum__hint { text-align: center; font-size: 18px; font-weight: 700; color: var(--ink-2); }
.btn { display: inline-grid; place-items: center; min-width: 30px; height: 30px; padding: 0 6px; border-radius: 50%; background: #5fd36f; color: #000; font-weight: 900; margin-right: 6px; }
</style>
