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
    title: 'Three eras, three elections.',
    lines: [
      'You start with a house, a shop, a factory and a street. Every turn you get a budget, draw five cards, and build.',
      'Each era you choose one of two Mandates: what the city must look like when the election comes. Meet all three and you win.',
      'Public Patience, top right, is the clock. At zero the election is held. Miss the Mandate and you are voted out.',
      'At the start, and after every election you win, adopt one of three Policies: a rule that stands for the rest of the run. They are listed at the left.'
    ]
  },
  {
    title: 'The budget resets every turn.',
    lines: [
      'Your budget is the revenue of everything you have built. The starting city earns 5.',
      'Spend it or lose it: nothing carries over unless a goal says so.',
      'Buildings cost budget to place. The number on the coin is the price.'
    ]
  },
  {
    title: 'Roads first, then buildings.',
    lines: [
      'A Road card lays up to two street segments, each joined to a street you already have.',
      'A building can only go on a plot that touches a street.',
      'Houses bring people. Shops and factories bring jobs. People without jobs turn to crime.'
    ]
  },
  {
    title: 'Growth makes a mess.',
    lines: [
      'A house adds a Crime card to your deck. A shop adds Trash. A factory adds Pollution.',
      'Those cards clog your hand and crowd out real cards.',
      'Build a Police Station, Sanitation Center or Clinic, then play the card from your hand into it. It is gone for good.'
    ]
  },
  {
    title: 'The market, then the clock.',
    lines: [
      'After building, buy one card from the City Row with what budget is left: the tag under it is its price, the coin on it what it costs to build. A Trade Fair gives an extra buy.',
      'Goals are free, one a turn. Meet the condition and claim it: it becomes a Monument to build.',
      'Each goal has a clock and expires when it runs out. Every four turns a disaster strikes, harder each time; each Fire Station blocks one card.'
    ]
  },
  {
    title: 'Patience, and a growing city.',
    lines: [
      'Patience drains every turn: faster with bad cards in your deck, idle workers and disasters. Parks, culture and civic buildings slow it, never stop it.',
      'Met the Mandate early? Pick it in the market to call the election now: half the patience left carries into the next era.',
      'Each new era widens the city limits and brings a new tier of buildings to the City Row. Street Permits (one-use Roads) are always for sale beside it, and two Roads combine into a Boulevard, two Boulevards into a Highway.',
      'Traffic: every building sends trips onto the streets beside it. A street carrying more than it can jams, and jams cost patience. More streets, Boulevards and Highways (wider), and transit nearby all help. Look at the city to see each street coloured by its load.'
    ]
  },
  {
    title: 'Look for combinations.',
    lines: [
      'Over a hundred buildings come to the City Row across the three eras.',
      'Some draw you extra cards, make others cheaper, or add Tourists and Commuters to your deck.',
      'Look for combinations: a Hotel beside a landmark, a Recycling Plant fed with Trash, a Coal Plant among factories.',
      'Combine two buildings in your hand (RT, or C) for budget: they leave your deck for good and become one new building with both of their stats and abilities. A home and a shop make a Mixed-Use Block; a factory and a park, a Tree Nursery. Two combined buildings of the same size combine again: two pairs make a Quarter, two Quarters a District, two Districts a Borough.',
      'Every building after your first three costs 1 budget a turn in upkeep (a combined one counts once), and each new era makes buildings dearer to build.'
    ]
  },
  {
    title: 'Where you build matters.',
    lines: [
      'Every building counts its four neighbours. Houses grow beside houses and shrink beside factories.',
      'Shops earn more beside houses and less beside other shops. Factories earn more in a cluster.',
      'Each game has its own map: a river, a lake or a coast. Nothing builds on water, but a home beside it houses one more and a shop beside it earns one more. A Road can bridge it.',
      'Big places cover more than one plot: a School two, a University an L of three, a Stadium a 2×2. Turn them with LB / RB (Q / R) while aiming. They count every neighbour they touch, and no street may run through them.',
      'While you aim, the panel shows what the spot is worth and what changes next door.'
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
