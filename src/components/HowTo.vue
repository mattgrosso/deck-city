<template>
  <div class="howto">
    <div class="howto__box">
      <div class="howto__eyebrow">How to play · {{ page + 1 }} of {{ PAGES.length }}</div>
      <h1 class="howto__title">{{ current.title }}</h1>
      <p v-for="(line, i) in current.lines" :key="i" class="howto__line">{{ line }}</p>
      <div class="howto__dots"><span v-for="(p, i) in PAGES" :key="i" class="dot" :class="{ 'dot--on': i === page }" /></div>
      <div class="howto__hint">
        <span class="btn btn--dpad">↔</span> Page
        <span class="btn btn--a">{{ glyphs.select }}</span> {{ page === PAGES.length - 1 ? 'Play' : 'Next' }}
        <span class="btn btn--b">{{ glyphs.back }}</span> Close
      </div>
    </div>
  </div>
</template>

<script>
// The rules, in six screens. Matt, after the first look: "It occurs to me
// that I don't really know how to play this game. I don't even have any idea
// what the rules are." Opens on the first game and from the pause menu.
export const PAGES = [
  {
    title: 'Build a city of 20 people.',
    lines: [
      'Every turn you get a budget, draw five cards, and build what you can.',
      'Reach a population of 20 and the city is finished. You win.',
      'Run the goal deck dry before that and the city stalls. You lose.'
    ]
  },
  {
    title: 'The budget resets every turn.',
    lines: [
      'Your budget is the revenue of everything you have built, plus 4 for the city itself.',
      'Spend it or lose it: nothing carries over unless a goal says so.',
      'Buildings cost budget to place. The number on the coin is the price.'
    ]
  },
  {
    title: 'Roads first, then buildings.',
    lines: [
      'A Road card lays one street segment between two plots.',
      'A building can only go on a plot that touches a street.',
      'Houses bring people. Shops and factories bring jobs and revenue.'
    ]
  },
  {
    title: 'Growth makes a mess.',
    lines: [
      'A house adds a Crime card to your deck. A shop adds Trash. A factory adds Pollution.',
      'Those cards do nothing. They clog your hand and crowd out real cards.',
      'A Police Station, Sanitation Center or Clinic eats one each turn.'
    ]
  },
  {
    title: 'The market, then the clock.',
    lines: [
      'After building, buy a card from the City Row with what budget is left.',
      'Goals are free. Meet the condition and claim it: it becomes a Monument you can build anywhere.',
      'Every four turns the cheapest unclaimed goal expires. Every four turns a disaster strikes unless a Fire Station stands.'
    ]
  },
  {
    title: 'Where you build matters.',
    lines: [
      'A Park pays its neighbouring houses, and invites crime there too.',
      'Some goals want three houses in a row, or a park beside a house.',
      'Pick a card, aim at a plot, place it. Done building, then the market, then end the turn.'
    ]
  }
]

export default {
  name: 'HowTo',
  props: { page: { type: Number, default: 0 }, glyphs: { type: Object, required: true } },
  data () { return { PAGES } },
  computed: { current () { return PAGES[Math.min(this.page, PAGES.length - 1)] } }
}
</script>

<style scoped>
.howto { position: absolute; inset: 0; z-index: 45; display: grid; place-items: center; background: rgba(233,238,245,0.9); backdrop-filter: blur(6px); }
.howto__box { width: 980px; background: #fff; border: 1.5px solid var(--line); border-radius: 18px; padding: 36px 44px 28px; box-shadow: 0 20px 60px rgba(27,33,48,0.18); }
.howto__eyebrow { font-size: 13px; letter-spacing: 0.28em; text-transform: uppercase; color: var(--ink-3); font-weight: 700; margin-bottom: 10px; }
.howto__title { font-size: 40px; font-weight: 900; margin: 0 0 16px; letter-spacing: -0.02em; line-height: 1.05; }
.howto__line { font-size: 22px; line-height: 1.4; margin: 0 0 10px; color: var(--ink-2); }
.howto__dots { display: flex; gap: 8px; margin: 18px 0 14px; }
.dot { width: 10px; height: 10px; border-radius: 50%; background: var(--line); }
.dot--on { background: var(--ink); }
.howto__hint { display: flex; align-items: center; gap: 10px; font-size: 16px; color: var(--ink-2); font-weight: 600; }
.btn { display: inline-grid; place-items: center; min-width: 26px; height: 26px; padding: 0 6px; border-radius: 50%; font-weight: 900; font-size: 14px; color: #000; margin-left: 10px; }
.btn--a { background: #5fd36f; }
.btn--b { background: #ff6b6b; }
.btn--dpad { background: #dfe5ee; border-radius: 7px; margin-left: 0; }
</style>
