<template>
  <div class="stage-wrap">
    <div class="stage" :style="{ transform: `scale(${scale})` }">
      <template v-if="screen === 'game'">
        <TopBar
          :turn="turn" :population="population" :population-target="POPULATION_TARGET" :jobs="jobs" :revenue="nextBudget"
          :statuses="statuses" :disaster-in="disasterIn" :headed-off="headedOff" :focus="mode === 'stats' ? STATS[statIndex].key : null"
        />

        <div class="board-wrap" :class="{ shake: shakeBoard }">
          <CityScene
            ref="scene"
            :grid="game.state.cityGrid" :structures="game.state.builtStructures" :tick="tick"
            :targeting="mode === 'target' || mode === 'look'" :valid-cells="validCells" :cursor="cursorCell"
            :valid-edges="validEdges" :cursor-edge="cursorEdge" :planned-edges="pendingEdges" :preview-card="mode === 'target' ? selectedCard : null"
            :width="1920" :height="1080" :rect="VIEW_RECT" :stage-scale="scale"
            @cell="onCellClick"
          />
        </div>

        <Market
          :city-row="cityRow" :goal-row="goalRow" :goal-timers="goalTimers" :catalog="game.catalog" :treasury="treasury"
          :active="mode === 'market'" :focus="market" :goal-met="goalMet" :goals-left="goalsLeft"
          @focus="onMarketFocus" @select="onMarketSelect"
        />

        <div class="phase-tag" :class="`phase-tag--${phaseName}`">{{ phaseLabel }}</div>

        <CardInfo v-if="mode === 'hand' || mode === 'civic' || mode === 'target'" :card="focusedHandCard" :catalog="game.catalog" />
        <InfoPanel v-if="mode === 'look' && lookInfo" v-bind="lookInfo" />
        <InfoPanel v-if="mode === 'stats'" v-bind="statInfo" />

        <!-- Budget orb and draw pile: bottom-left (§1). -->
        <div class="orb-wrap" :class="{ shake: shakeOrb }">
          <div class="orb" :class="{ 'orb--empty': treasury === 0 }">
            <div class="orb__num">{{ treasury }}</div>
            <div class="orb__label">budget</div>
          </div>
          <div class="pile-btn" @click="openPile(0)">
            <svg viewBox="0 0 24 24"><path :d="icons.deck" /></svg>
            <span class="pile-btn__num">{{ game.state.deck.drawPile.length }}</span>
            <span class="pile-btn__label">draw</span>
          </div>
          <div v-for="p in pops" :key="p.id" class="pop" :style="{ left: `${p.x}px`, top: `${p.y}px`, color: p.color }">{{ p.text }}</div>
        </div>

        <!-- End-of-phase and discard pile: bottom-right (§1, §6). -->
        <div class="end-wrap">
          <button class="end-btn" :class="{ 'end-btn--ready': canEndPhase }" :disabled="!canEndPhase" @click="act('confirm', 'click')">
            <span class="btn btn--y">{{ glyphs.confirm }}</span>
            <span>{{ endLabel }}</span>
          </button>
          <div class="pile-btn" @click="openPile(1)">
            <svg viewBox="0 0 24 24"><path :d="icons.deck" /></svg>
            <span class="pile-btn__num">{{ game.state.deck.discardPile.length }}</span>
            <span class="pile-btn__label">discard</span>
          </div>
        </div>

        <Hand
          :hand="game.state.hand" :keys="handKeys" :catalog="game.catalog"
          :focused-index="handActive ? handIndex : null" :picks="picks" :dim="!handActive" :can-play="canPlay"
          @focus="onHandFocus" @select="onHandSelect"
        />

        <transition name="toast">
          <div v-if="toast" :key="toast.id" class="toast" :class="`toast--${toast.kind}`">{{ toast.text }}</div>
        </transition>

        <PileView v-if="mode === 'pile'" :tabs="pileTabs" :tab-index="pileTab" :focus-index="pileIndex" :catalog="game.catalog" @tab="pileTab = $event; pileIndex = 0" @focus="pileIndex = $event" />

        <Overlay v-if="mode === 'summary'" kind="summary" eyebrow="Overnight" :title="summary.title" :lines="summary.lines" hint="Continue" :glyph="glyphs.select" />
        <Overlay v-if="mode === 'over'" :kind="game.state.gameStatus" :eyebrow="`Turn ${turn}`" :title="game.state.gameStatus === 'won' ? 'City complete' : 'Out of goals'" :lines="overLines" hint="New game" :glyph="glyphs.select" />
        <Overlay v-if="mode === 'menu'" kind="plain" title="Paused" :items="MENU_ITEMS" :index="menuIndex" hint="Choose" :glyph="glyphs.select" @pick="menuIndex = $event; act('select', 'click')" />
        <HowTo v-if="mode === 'howto'" :page="howtoPage" :glyphs="glyphs" />
      </template>

      <Overlay v-if="screen === 'title'" kind="title" eyebrow="A deck-building city builder" title="Deck City" :lines="['Build a city of 20 people before the goals run out.', 'Press Enter or click to start full screen.']" hint="Start" :glyph="glyphs.select" @click="act('select', 'click')" />

      <ButtonLegend :items="legend" :pad="pad" />
      <p class="build-stamp" role="button" tabindex="0" title="Tap to reload" @click="stampTap">{{ refreshing ? 'reloading…' : stamp }}</p>
    </div>
    <BugReportButton v-if="firebaseConfigured" />
    <BugResolutionNotice v-if="firebaseConfigured" />
  </div>
</template>

<script>
import TopBar from '@/components/TopBar.vue'
import CityScene from '@/components/CityScene.vue'
import Market from '@/components/Market.vue'
import Hand from '@/components/Hand.vue'
import PileView from '@/components/PileView.vue'
import Overlay from '@/components/Overlay.vue'
import ButtonLegend from '@/components/ButtonLegend.vue'
import CardInfo from '@/components/CardInfo.vue'
import InfoPanel from '@/components/InfoPanel.vue'
import HowTo, { PAGES as HOWTO_PAGES } from '@/components/HowTo.vue'
import BugReportButton from '@/components/shared/BugReportButton.vue'
import BugResolutionNotice from '@/components/shared/BugResolutionNotice.vue'
import {
  createGame, starterCards, facilityCards, goalCards, disasterCards,
  calcStatTotal, countCardsByTag, evaluateCondition, isCellEmpty, isBuildable, listConnectedEdges
} from '@/game/core'
import { attachInput, GLYPHS } from '@/ui/input'
import { stepCursor, nearestCell } from '@/ui/layout'
import { rulesFor, FAMILIES, familyOf } from '@/ui/cardText'
import { ICONS } from '@/ui/icons'
import { firebaseConfigured } from '@/firebase'
import { buildStamp, forceRefresh } from '@/utils/buildStamp'
import { initUpdateCheck } from '@/utils/checkForUpdate'

// The city you start with: two houses and a shop on the starting street.
// Their revenue IS the first budget - there is no base income any more.
// Matt: "the city at the beginning of the game [should] reflect what our
// budget is" (the Suburbia opening: three tiles that add up to your start).
const STARTING_BUILDINGS = [
  { cardId: 'residential', x: 5, y: 3 }, // 2 people, +1
  { cardId: 'commercial', x: 6, y: 3 }, // 2 jobs, +2
  { cardId: 'industrial', x: 5, y: 4 } // 3 jobs, +2 - everyone employed, budget 5
]
// The clear part of the stage (left of the market, above the hand) the city is framed into.
const VIEW_RECT = { x: 40, y: 90, w: 1130, h: 690 }
const BASE_REVENUE = 0
const POPULATION_TARGET = 20
const MENU_ITEMS = ['Resume', 'How to play', 'New game']
const HOWTO_SEEN = 'deck-city:howto-seen'

// The numbers along the top, in cursor order, and what each one means.
const STATS = [
  { key: 'population', title: 'Population', explain: (a) => [`${a.population} of ${POPULATION_TARGET}. Reach ${POPULATION_TARGET} and the city is finished.`, 'Houses add 2 each. A claimed goal (a Monument) adds 1.'] },
  { key: 'jobs', title: 'Jobs', explain: (a) => [`${a.jobs} jobs for ${a.population} people. Shops give 2, factories 3.`, a.population > a.jobs ? `${a.population - a.jobs} people have no work: a Crime card joins your deck at the end of every turn this stays true.` : 'Everyone has work. Keep it that way as the city grows, or crime follows.'] },
  { key: 'budget', title: 'Next budget', explain: (a) => [`${a.nextBudget} next turn, the revenue of every building you have.`, `Unspent budget is lost at the end of the turn${a.rolloverCap ? ` except up to ${a.rolloverCap} (City Bank)` : ''}.`] },
  { key: 'crime', title: 'Crime', explain: (a) => [`${a.crime} Crime card${a.crime === 1 ? '' : 's'} in your deck. A house adds one when built; a Park adds one per neighbouring house each turn; unemployment adds one a turn.`, 'Play a Crime card from your hand into a Police Station with a free slot and it leaves the game.'] },
  { key: 'trash', title: 'Trash', explain: (a) => [`${a.trash} Trash card${a.trash === 1 ? '' : 's'} in your deck. A shop adds one when built.`, 'Play a Trash card from your hand into a Sanitation Center with a free slot and it leaves the game.'] },
  { key: 'pollution', title: 'Pollution', explain: (a) => [`${a.pollution} Pollution card${a.pollution === 1 ? '' : 's'} in your deck. A factory adds one when built.`, 'Play a Pollution card from your hand into a Clinic with a free slot and it leaves the game.'] },
  { key: 'disaster', title: 'Disaster clock', explain: (a) => [`Strikes in ${a.disasterIn} turn${a.disasterIn === 1 ? '' : 's'}. Strike ${a.strikes + 1} will shuffle ${a.strikes + 1} disaster card${a.strikes ? 's' : ''} into your deck; each bites when drawn.`, a.blockers ? `${a.blockers} Fire Station${a.blockers === 1 ? '' : 's'} standing: each blocks one card per strike.` : 'A Fire Station blocks one card per strike. Strikes get bigger, so build more over time.'] }
]

export default {
  name: 'App',
  components: { TopBar, CityScene, Market, Hand, PileView, Overlay, ButtonLegend, CardInfo, InfoPanel, HowTo, BugReportButton, BugResolutionNotice },
  // The house bug button has no store to read; it asks this for a snapshot.
  provide () {
    return { bugSnapshot: () => this.bugSnapshot() }
  },
  data () {
    return {
      POPULATION_TARGET,
      VIEW_RECT,
      MENU_ITEMS,
      STATS,
      icons: ICONS,
      screen: 'title',
      game: null,
      tick: 0,
      scale: 1,
      pad: null, // 'xbox' | 'playstation' | 'switch' | 'generic' | null
      // hand | target | civic | market | pile | summary | over | menu | look | stats | howto
      mode: 'hand',
      handIndex: 0,
      selectedIndex: null,
      // Aiming: the things the cursor can be on, with their stage-pixel
      // positions, so the d-pad moves in SCREEN directions on an isometric board.
      targets: [],
      targetIndex: 0,
      pendingEdges: [], // street segments laid so far by the Road card in hand
      lastAim: { x: 560, y: 420 },
      picks: [],
      market: { row: 0, index: 0 },
      statIndex: 0,
      pileTab: 0,
      pileIndex: 0,
      pileReturn: 'hand',
      menuIndex: 0,
      menuReturn: 'hand',
      howtoPage: 0,
      howtoReturn: 'hand',
      summary: { title: '', lines: [] },
      toast: null,
      toastId: 0,
      pops: [],
      popId: 0,
      shakeBoard: false,
      shakeOrb: false,
      firebaseConfigured,
      stamp: buildStamp(),
      refreshing: false
    }
  },
  created () {
    this.newGame()
  },
  mounted () {
    this.fit()
    window.addEventListener('resize', this.fit)
    this.detach = attachInput({ onAction: this.act, onPadChange: (kind) => { this.pad = kind } })
    // Auto-update (house standard): a reload only on the title screen or a
    // finished game - a game in progress lives in memory and nowhere else.
    const self = this
    initUpdateCheck({ get state () { return { game: self.screen === 'game' ? self.game.state : null } } })
  },
  beforeUnmount () {
    window.removeEventListener('resize', this.fit)
    this.detach?.()
  },
  computed: {
    glyphs () { return GLYPHS[this.pad ?? 'keyboard'] ?? GLYPHS.generic },
    // Every computed touches `tick`: the engine mutates plain objects
    // outside Vue's reactivity, so a bump is what makes these re-read.
    turn () { void this.tick; return this.game.turnManager.turnNumber + 1 },
    phaseName () { void this.tick; return this.game.turnManager.phases[this.game.turnManager.currentPhaseIndex].name },
    phaseLabel () { return this.phaseName === 'acquire' ? 'Acquire' : 'Build' },
    treasury () { void this.tick; return this.game.state.treasury },
    population () { void this.tick; return calcStatTotal(this.game.state, 'population') },
    jobs () { void this.tick; return calcStatTotal(this.game.state, 'jobs') },
    nextBudget () { void this.tick; return calcStatTotal(this.game.state, 'revenue') + BASE_REVENUE },
    statuses () {
      void this.tick
      return [
        { name: 'crime', icon: 'crime', count: countCardsByTag(this.game.state, 'crime') },
        { name: 'trash', icon: 'trash', count: countCardsByTag(this.game.state, 'trash') },
        { name: 'pollution', icon: 'pollution', count: countCardsByTag(this.game.state, 'pollution') }
      ]
    },
    disasterIn () { void this.tick; return this.game.state.disasterTimer.turnsUntilDeadline },
    headedOff () { void this.tick; return this.game.state.disasterTimer.headedOff },
    cityRow () { void this.tick; return this.game.cityRow.cards },
    goalRow () { void this.tick; return this.game.goalRow.cards },
    goalsLeft () { void this.tick; return this.game.goalRow.sourceDeck.drawPile.length },
    goalTimers () { void this.tick; return [...this.game.goalRow.timers] },
    handKeys () {
      void this.tick
      const seen = {}
      return this.game.state.hand.map(card => { seen[card.id] = (seen[card.id] ?? 0) + 1; return `${card.id}#${seen[card.id]}` })
    },
    handActive () { return this.mode === 'hand' || this.mode === 'civic' || this.mode === 'target' },
    focusedHandCard () { void this.tick; return this.game.state.hand[this.handIndex] ?? null },
    selectedCard () { void this.tick; return this.selectedIndex === null ? null : this.game.state.hand[this.selectedIndex] ?? null },
    currentTarget () { return this.targets[this.targetIndex] ?? null },
    validCells () { return this.mode === 'target' ? this.targets.filter(t => t.kind === 'cell').map(t => ({ x: t.x, y: t.y })) : [] },
    validEdges () { return this.mode === 'target' ? this.targets.filter(t => t.kind === 'edge').map(t => t.key) : [] },
    cursorCell () { const t = this.currentTarget; return (this.mode === 'target' || this.mode === 'look') && t?.kind === 'cell' ? { x: t.x, y: t.y } : null },
    cursorEdge () { const t = this.currentTarget; return this.mode === 'target' && t?.kind === 'edge' ? t.key : null },
    canEndPhase () { return this.mode === 'hand' || this.mode === 'market' },
    endLabel () { return this.phaseName === 'acquire' ? 'End turn' : 'Done building' },
    lookInfo () {
      void this.tick
      const t = this.currentTarget
      if (!t || t.kind !== 'cell') return null
      const id = this.game.state.cityGrid.cells[t.y * this.game.state.cityGrid.width + t.x]
      const inst = this.game.state.builtStructures.find(s => s.instanceId === id)
      if (!inst) return { eyebrow: 'Empty plot', title: `Plot ${t.x + 1}, ${t.y + 1}`, lines: [isBuildable(this.game.state.cityGrid, t.x, t.y) ? 'Touches a street: you can build here.' : 'No street yet. Lay a Road beside it first.'] }
      const lines = rulesFor(inst.card, this.game.catalog)
      if (inst.slots) lines.push(`${inst.slots.used} of ${inst.slots.capacity} slots used this turn.`)
      return { eyebrow: FAMILIES[familyOf(inst.card)].label, title: inst.card.name, lines, tone: inst.card.type === 'goal' ? 'gold' : 'plain' }
    },
    statInfo () {
      void this.tick
      const stat = STATS[this.statIndex]
      const about = {
        population: this.population, jobs: this.jobs, nextBudget: this.nextBudget, rolloverCap: this.game.state.treasuryRolloverCap,
        crime: this.statuses[0].count, trash: this.statuses[1].count, pollution: this.statuses[2].count,
        disasterIn: this.disasterIn, headedOff: this.headedOff,
        strikes: this.game.state.disasterTimer.strikes ?? 0,
        blockers: this.game.state.builtStructures.filter(i => i.card.blocksDisasters).length
      }
      return { eyebrow: 'What this means', title: stat.title, lines: stat.explain(about) }
    },
    pileTabs () {
      void this.tick
      const byName = (a, b) => a.name.localeCompare(b.name)
      const deck = this.game.state.deck
      return [
        { key: 'draw', label: 'Draw pile', cards: [...deck.drawPile].sort(byName), note: 'Shown in alphabetical order, not draw order.' },
        { key: 'discard', label: 'Discard', cards: [...deck.discardPile] },
        { key: 'all', label: 'Whole deck', cards: [...deck.drawPile, ...deck.discardPile, ...this.game.state.hand].sort(byName) }
      ]
    },
    overLines () {
      void this.tick
      const s = this.game.state
      return this.game.state.gameStatus === 'won'
        ? [`Population ${this.population} with ${s.builtStructures.length} buildings on turn ${this.turn}.`]
        : [`Population reached ${this.population} of ${POPULATION_TARGET} before the goal deck ran dry.`]
    },
    legend () {
      const L = (action, label) => ({ action, label })
      switch (this.screen === 'title' ? 'title' : this.mode) {
        case 'title': return [L('select', 'Start')]
        case 'hand': return [L('lr', 'Choose card'), L('select', 'Play'), L('up', 'Look at the city'), L('confirm', this.endLabel), L('deck', 'Deck'), L('menu', 'Menu')]
        case 'target': return this.pendingEdges.length ? [L('dpad', 'Aim the second segment'), L('select', 'Place'), L('back', 'Keep just one')] : [L('dpad', 'Aim'), L('select', 'Place'), L('back', 'Back')]
        case 'civic': return [L('lr', 'Choose'), L('select', 'Mark to discard'), L('back', 'Back')]
        case 'market': return [L('dpad', 'Browse'), L('select', 'Buy / Claim'), L('up', 'Look at the city'), L('confirm', 'End turn'), L('deck', 'Deck'), L('menu', 'Menu')]
        case 'look': return [L('dpad', 'Move'), L('up', 'Top bar'), L('back', 'Back')]
        case 'stats': return [L('lr', 'Next number'), L('back', 'Back')]
        case 'pile': return [L('prevPile', 'Prev'), L('nextPile', 'Next'), L('dpad', 'Browse'), L('back', 'Close')]
        case 'menu': return [L('dpad', 'Choose'), L('select', 'Pick'), L('back', 'Resume')]
        case 'howto': return [L('lr', 'Page'), L('select', 'Next'), L('back', 'Close')]
        default: return [L('select', 'Continue')]
      }
    }
  },
  methods: {
    fit () {
      this.scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
    },
    refresh () { this.tick++ },
    newGame () {
      this.game = createGame({
        cardCatalog: [
          ...starterCards.STARTER_CARD_CATALOG, ...facilityCards.FACILITY_CATALOG,
          ...goalCards.GOAL_CATALOG, ...disasterCards.DISASTER_CATALOG
        ],
        startingDeckCardIds: starterCards.STARTER_DECK_CARDS,
        cityDeckCardIds: facilityCards.CITY_DECK_CARDS,
        goalDeckCardIds: goalCards.GOAL_DECK_CARDS,
        disasterCardIds: disasterCards.DISASTER_CARDS,
        baseRevenue: BASE_REVENUE,
        populationTarget: POPULATION_TARGET,
        startingBuildings: STARTING_BUILDINGS
      })
      // The engine starts on 'draw'; running it deals the first hand and
      // lands on 'build', the first phase the player acts in.
      this.game.actions.advance()
      this.mode = 'hand'
      this.handIndex = 0
      this.selectedIndex = null
      this.targets = []
      this.pendingEdges = []
      this.picks = []
      this.market = { row: 1, index: 0 }
      this.refresh()
    },
    startGame () {
      this.screen = 'game'
      let seen = false
      try { seen = window.localStorage.getItem(HOWTO_SEEN) === '1' } catch { /* no storage */ }
      if (!seen) this.openHowTo('hand')
    },

    // ----- input -----------------------------------------------------
    act (action, source = 'pad') {
      if (this.screen === 'title') {
        if (action === 'select' || action === 'confirm') {
          // Browsers only grant full screen on a real user gesture, which a
          // gamepad press is not (Chrome, Safari): the keyboard and the mouse
          // get it here; a controller player presses Enter once.
          if (source !== 'pad') document.documentElement.requestFullscreen?.().catch(() => {})
          this.startGame()
        }
        return
      }
      const handler = this[`in_${this.mode}`]
      if (handler) handler(action)
    },
    in_hand (action) {
      const n = this.game.state.hand.length
      if (action === 'left' && n) this.handIndex = (this.handIndex - 1 + n) % n
      else if (action === 'right' && n) this.handIndex = (this.handIndex + 1) % n
      else if (action === 'select') this.tryPlay(this.handIndex)
      else if (action === 'up') this.openLook('hand')
      else if (action === 'confirm') this.endBuild()
      else if (action === 'deck') this.openPile(0)
      else if (action === 'menu') this.openMenu()
    },
    in_target (action) {
      if (['up', 'down', 'left', 'right'].includes(action)) this.moveAim(action)
      else if (action === 'select') this.placeAt(this.currentTarget)
      else if (action === 'back') {
        // A Road with one segment already aimed: B keeps that one and plays the card.
        if (this.pendingEdges.length) return this.commitRoad(this.pendingEdges)
        this.mode = 'hand'; this.selectedIndex = null; this.targets = []
      }
    },
    in_civic (action) {
      const n = this.game.state.hand.length
      const others = [...Array(n).keys()].filter(i => i !== this.selectedIndex)
      if (!others.length) { this.mode = 'hand'; return }
      const pos = Math.max(0, others.indexOf(this.handIndex))
      if (action === 'left') this.handIndex = others[(pos - 1 + others.length) % others.length]
      else if (action === 'right') this.handIndex = others[(pos + 1) % others.length]
      else if (action === 'select') this.togglePick(this.handIndex)
      else if (action === 'back') { this.mode = 'hand'; this.picks = []; this.handIndex = this.selectedIndex; this.selectedIndex = null }
    },
    in_market (action) {
      const rows = [this.cityRow, this.goalRow]
      const { row, index } = this.market
      const len = rows[row].length
      if (action === 'left' && len) this.market = { row, index: (index - 1 + len) % len }
      else if (action === 'right' && len) this.market = { row, index: (index + 1) % len }
      else if (action === 'up' && row === 0) this.market = { row: 1, index: Math.min(index, Math.max(0, rows[1].length - 1)) }
      else if (action === 'down' && row === 1) this.market = { row: 0, index: Math.min(index, Math.max(0, rows[0].length - 1)) }
      else if (action === 'up') this.openLook('market')
      else if (action === 'select') this.buyOrClaim()
      else if (action === 'confirm') this.endTurn()
      else if (action === 'deck') this.openPile(1)
      else if (action === 'menu') this.openMenu()
    },
    in_look (action) {
      if (action === 'back' || action === 'down' && this.atBottomOfLook()) { this.mode = this.lookReturn; this.targets = []; return }
      if (action === 'up' && this.atTopOfLook()) { this.openStats(this.lookReturn); return }
      if (['up', 'down', 'left', 'right'].includes(action)) this.moveAim(action)
      else if (action === 'menu') this.openMenu()
    },
    in_stats (action) {
      if (action === 'left') this.statIndex = (this.statIndex + STATS.length - 1) % STATS.length
      else if (action === 'right') this.statIndex = (this.statIndex + 1) % STATS.length
      else if (action === 'back' || action === 'down' || action === 'select') this.mode = this.statsReturn
      else if (action === 'menu') this.openMenu()
    },
    in_pile (action) {
      const cards = this.pileTabs[this.pileTab].cards
      const cols = 9
      if (action === 'prevPile') { this.pileTab = (this.pileTab + 2) % 3; this.pileIndex = 0 } else if (action === 'nextPile') { this.pileTab = (this.pileTab + 1) % 3; this.pileIndex = 0 } else if (action === 'left' && cards.length) this.pileIndex = Math.max(0, this.pileIndex - 1)
      else if (action === 'right' && cards.length) this.pileIndex = Math.min(cards.length - 1, this.pileIndex + 1)
      else if (action === 'up') this.pileIndex = Math.max(0, this.pileIndex - cols)
      else if (action === 'down' && cards.length) this.pileIndex = Math.min(cards.length - 1, this.pileIndex + cols)
      else if (action === 'back' || action === 'deck') this.mode = this.pileReturn
    },
    in_summary (action) {
      if (action === 'select' || action === 'confirm') this.afterSummary()
    },
    in_over (action) {
      if (action === 'select' || action === 'confirm') this.newGame()
    },
    in_menu (action) {
      if (action === 'up') this.menuIndex = (this.menuIndex + MENU_ITEMS.length - 1) % MENU_ITEMS.length
      else if (action === 'down') this.menuIndex = (this.menuIndex + 1) % MENU_ITEMS.length
      else if (action === 'back' || action === 'menu') this.mode = this.menuReturn
      else if (action === 'select') {
        const item = MENU_ITEMS[this.menuIndex]
        if (item === 'New game') this.newGame()
        else if (item === 'How to play') this.openHowTo(this.menuReturn)
        else this.mode = this.menuReturn
      }
    },
    in_howto (action) {
      const last = HOWTO_PAGES.length - 1
      if (action === 'left') this.howtoPage = Math.max(0, this.howtoPage - 1)
      else if (action === 'right') this.howtoPage = Math.min(last, this.howtoPage + 1)
      else if (action === 'select' || action === 'confirm') { if (this.howtoPage < last) this.howtoPage++; else this.closeHowTo() } else if (action === 'back' || action === 'menu') this.closeHowTo()
    },

    // ----- aiming on an isometric board ------------------------------
    // Targets carry their stage-pixel position; the d-pad picks the nearest
    // one in the pressed SCREEN direction. Matt: "the grid is isometric...
    // it's still expecting orthogonal directions... confusing."
    screenOf (t) {
      const scene = this.$refs.scene
      if (!scene) return { x: t.x * 100, y: t.y * 100 }
      return t.kind === 'edge' ? scene.screenOfEdge(t.key) : scene.screenOfCell(t.x, t.y)
    },
    withScreen (targets) {
      return targets.map(t => { const p = this.screenOf(t); return { ...t, sx: p.x, sy: p.y } })
    },
    moveAim (dir) {
      const here = this.currentTarget
      if (!here) return
      const points = this.targets.map((t, i) => ({ x: t.sx, y: t.sy, i }))
      const next = stepCursor({ x: here.sx, y: here.sy }, dir, points)
      if (next.i !== undefined) this.targetIndex = next.i
    },
    aimNearest (point) {
      const pts = this.targets.map((t, i) => ({ x: t.sx, y: t.sy, i }))
      const best = nearestCell(point, pts)
      this.targetIndex = best ? best.i : 0
    },
    atTopOfLook () { const t = this.currentTarget; return !this.targets.some(o => o !== t && o.sy < t.sy - 10) },
    atBottomOfLook () { const t = this.currentTarget; return !this.targets.some(o => o !== t && o.sy > t.sy + 10) },

    // ----- mouse -----------------------------------------------------
    onHandFocus (i) { if (this.mode === 'hand' || this.mode === 'civic') this.handIndex = i },
    onHandSelect (i) {
      if (this.mode === 'hand') { this.handIndex = i; this.tryPlay(i) } else if (this.mode === 'civic' && i !== this.selectedIndex) { this.handIndex = i; this.togglePick(i) }
    },
    onCellClick (cell) {
      if (this.mode !== 'target' && this.mode !== 'look') return
      const i = this.targets.findIndex(t => t.kind === 'cell' && t.x === cell.x && t.y === cell.y)
      if (i === -1) return
      this.targetIndex = i
      if (this.mode === 'target') this.placeAt(this.currentTarget)
    },
    onMarketFocus (f) { if (this.mode === 'market') this.market = f },
    onMarketSelect (f) { if (this.mode === 'market') { this.market = f; this.buyOrClaim() } },

    // ----- play ------------------------------------------------------
    canPlay (card) {
      if (this.phaseName !== 'build') return false
      if (card.type === 'status') return !!this.slotFor(card)
      if (card.type === 'disaster') return false
      return (card.cost ?? 0) <= this.treasury
    },
    /** The built facility that could take this status card right now, if any. */
    slotFor (card) {
      void this.tick
      return this.game.state.builtStructures.find(i => i.card.clears === card.id && i.slots && i.slots.used < i.slots.capacity) ?? null
    },
    clearerName (card) {
      return { crime: 'Police Station', trash: 'Sanitation Center', pollution: 'Clinic' }[card.id] ?? 'facility'
    },
    tryPlay (index) {
      const card = this.game.state.hand[index]
      if (!card) return
      if (card.type === 'disaster') return this.refuse(`${card.name} can't be played. It already bit when you drew it.`)
      if (card.type === 'status') {
        const slot = this.slotFor(card)
        if (!slot) return this.refuse(`No free slot for ${card.name}. Build a ${this.clearerName(card)} or wait a turn.`)
        try { this.game.actions.clearStatus(card.id) } catch (err) { return this.refuse(err.message) }
        this.say(`${slot.card.name} took the ${card.name} card. It's gone for good.`, 'good')
        this.handIndex = Math.min(this.handIndex, Math.max(0, this.game.state.hand.length - 1))
        this.refresh()
        return
      }
      if ((card.cost ?? 0) > this.treasury) return this.refuse(`${card.name} costs ${card.cost}. You have ${this.treasury}.`, 'orb')
      if (card.type === 'civic') {
        if (this.game.state.hand.length < 2) return this.refuse('Nothing else in hand to discard.')
        this.selectedIndex = index
        this.picks = []
        this.mode = 'civic'
        this.handIndex = index === 0 ? 1 : 0
        return
      }
      const grid = this.game.state.cityGrid
      let targets
      if (card.placesRoad) {
        this.pendingEdges = []
        targets = listConnectedEdges(grid).map(e => ({ id: e.key, kind: 'edge', key: e.key }))
      } else {
        targets = []
        for (let y = 0; y < grid.height; y++) {
          for (let x = 0; x < grid.width; x++) {
            if (!isCellEmpty(grid, x, y)) continue
            if (card.skipsRoadRequirement || isBuildable(grid, x, y)) targets.push({ id: `${x},${y}`, kind: 'cell', x, y })
          }
        }
      }
      if (!targets.length) return this.refuse(card.placesRoad ? 'Nowhere left to lay a street.' : 'No empty plot beside a street. Lay a Road first.', 'board')
      this.selectedIndex = index
      this.targets = this.withScreen(targets)
      this.aimNearest(this.lastAim)
      this.mode = 'target'
    },
    placeAt (target) {
      const card = this.selectedCard
      if (!card || !target) return
      if (target.kind === 'edge') {
        // A Road lays up to two segments: aim the next one from the streets
        // so far, or commit when the card is spent.
        const edges = [...this.pendingEdges, target.key]
        this.lastAim = { x: target.sx, y: target.sy }
        if (edges.length < (card.roadSegments ?? 2)) {
          const more = listConnectedEdges(this.game.state.cityGrid, edges).map(e => ({ id: e.key, kind: 'edge', key: e.key }))
          if (more.length) {
            this.pendingEdges = edges
            this.targets = this.withScreen(more)
            this.aimNearest(this.lastAim)
            return
          }
        }
        return this.commitRoad(edges)
      }
      try {
        this.game.actions.playCard(card.id, { x: target.x, y: target.y })
      } catch (err) {
        return this.refuse(err.message, 'board')
      }
      this.lastAim = { x: target.sx, y: target.sy }
      this.afterPlay(card, `${card.name} built.`)
    },
    commitRoad (edges) {
      const card = this.selectedCard
      try {
        this.game.actions.playCard(card.id, { edges })
      } catch (err) {
        this.pendingEdges = []
        return this.refuse(err.message, 'board')
      }
      this.pendingEdges = []
      this.afterPlay(card, edges.length === 1 ? 'One street segment laid.' : 'Two street segments laid.')
    },
    afterPlay (card, message) {
      if (card.cost) this.pop(`-${card.cost}`, 'orb')
      if (card.stats?.population) this.pop(`+${card.stats.population} pop`, 'board', 'var(--green)')
      this.say(message)
      this.mode = 'hand'
      this.selectedIndex = null
      this.targets = []
      this.handIndex = Math.min(this.handIndex, Math.max(0, this.game.state.hand.length - 1))
      this.refresh()
    },
    togglePick (i) {
      const at = this.picks.indexOf(i)
      if (at !== -1) { this.picks.splice(at, 1); return }
      this.picks.push(i)
      const need = Math.min(2, this.game.state.hand.length - 1)
      if (this.picks.length < need) return
      const civic = this.game.state.hand[this.selectedIndex]
      const ids = this.picks.map(p => this.game.state.hand[p].id)
      try {
        this.game.actions.playCivicCard(civic.id, ids)
        this.say(`${civic.name}: discarded ${ids.length}, drew 2.`)
      } catch (err) {
        this.refuse(err.message)
      }
      this.picks = []
      this.selectedIndex = null
      this.mode = 'hand'
      this.handIndex = 0
      this.refresh()
    },
    endBuild () {
      this.game.actions.advance() // build -> acquire
      this.mode = 'market'
      const firstAffordable = this.cityRow.findIndex(c => (c.cost ?? 0) <= this.treasury)
      const firstReady = this.goalRow.findIndex(g => this.goalMet(g))
      this.market = firstReady !== -1 ? { row: 1, index: firstReady } : { row: 0, index: Math.max(0, firstAffordable) }
      this.refresh()
    },
    goalMet (goal) {
      void this.tick
      return evaluateCondition(goal.condition, { state: this.game.state, catalog: this.game.catalog })
    },
    buyOrClaim () {
      const { row, index } = this.market
      if (row === 0) {
        const card = this.cityRow[index]
        if (!card) return
        if ((card.cost ?? 0) > this.treasury) return this.refuse(`${card.name} costs ${card.cost}. You have ${this.treasury}.`, 'orb')
        try { this.game.actions.acquireCard(card.id) } catch (err) { return this.refuse(err.message) }
        this.pop(`-${card.cost}`, 'orb')
        this.say(`${card.name} added to your deck.`)
      } else {
        const goal = this.goalRow[index]
        if (!goal) return
        if (!this.goalMet(goal)) return this.refuse(`${goal.name} isn't ready yet.`)
        try { this.game.actions.claimGoal(goal.id) } catch (err) { return this.refuse(err.message) }
        this.say(`${goal.name} claimed. It's a Monument in your deck now.`, 'good')
      }
      const rows = [this.cityRow, this.goalRow]
      this.market = { row, index: Math.min(index, Math.max(0, rows[row].length - 1)) }
      this.refresh()
    },
    endTurn () {
      const before = this.game.log.length
      // acquire -> endOfTurn -> cleanup -> draw -> build: four steps, the
      // last of which deals the next hand.
      for (let i = 0; i < 4; i++) this.game.actions.advance()
      const lines = this.game.log.slice(before)
      this.refresh()
      this.summary = { title: `Turn ${this.turn}`, lines: lines.length ? lines : ['Nothing happened overnight.'] }
      this.mode = 'summary'
    },
    afterSummary () {
      if (this.game.state.gameStatus !== 'playing') { this.mode = 'over'; return }
      this.mode = 'hand'
      this.handIndex = 0
    },
    openPile (tab) {
      if (this.mode !== 'hand' && this.mode !== 'market') return
      this.pileReturn = this.mode
      this.pileTab = tab
      this.pileIndex = 0
      this.mode = 'pile'
    },
    openMenu () {
      this.menuReturn = this.mode === 'look' || this.mode === 'stats' ? this.lookReturn ?? 'hand' : this.mode
      this.menuIndex = 0
      this.mode = 'menu'
    },
    openLook (from) {
      const grid = this.game.state.cityGrid
      const targets = []
      for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) targets.push({ id: `${x},${y}`, kind: 'cell', x, y })
      this.lookReturn = from
      this.targets = this.withScreen(targets)
      // Start on a building if there is one, else the middle of the field.
      const built = this.targets.filter(t => grid.cells[t.y * grid.width + t.x])
      this.aimNearest(built.length ? { x: built[0].sx, y: built[0].sy } : this.lastAim)
      this.mode = 'look'
    },
    openStats (from) {
      this.statsReturn = from
      this.targets = []
      this.mode = 'stats'
    },
    openHowTo (from) {
      this.howtoReturn = from
      this.howtoPage = 0
      this.mode = 'howto'
    },
    closeHowTo () {
      try { window.localStorage.setItem(HOWTO_SEEN, '1') } catch { /* no storage */ }
      this.mode = this.howtoReturn
    },

    // ----- house kit -------------------------------------------------
    bugSnapshot () {
      const s = this.game.state
      return {
        gameState: {
          turn: this.turn,
          phase: this.phaseName,
          mode: this.mode,
          treasury: s.treasury,
          population: this.population,
          hand: s.hand.map(c => c.id),
          drawPile: s.deck.drawPile.map(c => c.id),
          discardPile: s.deck.discardPile.map(c => c.id),
          built: s.builtStructures.map(i => ({ id: i.card.id, at: i.position })),
          roads: [...s.cityGrid.roads],
          cityRow: this.cityRow.map(c => c.id),
          goalRow: this.goalRow.map(c => c.id),
          disaster: s.disasterTimer,
          gameStatus: s.gameStatus,
          log: this.game.log.slice(-20)
        },
        user: null,
        context: { screen: this.screen, pad: this.pad, scale: this.scale }
      }
    },
    stampTap () {
      this.refreshing = true
      forceRefresh()
    },

    // ----- feedback --------------------------------------------------
    say (text, kind = 'plain') {
      this.toast = { text, kind, id: ++this.toastId }
      clearTimeout(this.toastTimer)
      this.toastTimer = setTimeout(() => { this.toast = null }, 2600)
    },
    refuse (text, where = 'hand') {
      this.say(text, 'bad')
      const key = where === 'orb' ? 'shakeOrb' : 'shakeBoard'
      this[key] = false
      requestAnimationFrame(() => { this[key] = true; setTimeout(() => { this[key] = false }, 360) })
    },
    pop (text, where, color = 'var(--gold)') {
      const at = where === 'orb' ? { x: 44, y: -16 } : { x: 700, y: 300 }
      const id = ++this.popId
      this.pops.push({ id, text, color, ...at })
      setTimeout(() => { this.pops = this.pops.filter(p => p.id !== id) }, 900)
    }
  }
}
</script>

<style scoped>
.board-wrap { position: absolute; left: 0; top: 0; z-index: 0; }
.phase-tag { position: absolute; left: 48px; top: 96px; z-index: 3; font-size: 14px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink-3); }
.phase-tag--acquire { color: #b47a0a; }

.orb-wrap { position: absolute; left: 36px; bottom: 72px; display: flex; align-items: flex-end; gap: 14px; }
.orb { width: 128px; height: 128px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #ffe8a3, #f2b63c 60%, #c98a12); color: #2e2000; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 0 0 5px rgba(242,182,60,0.22), 0 12px 30px rgba(27,33,48,0.25); }
.orb--empty { filter: grayscale(0.6) brightness(0.95); }
.orb__num { font-size: 60px; font-weight: 900; line-height: 1; }
.orb__label { font-size: 13px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; margin-top: 2px; }

.pile-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 92px; height: 92px; border-radius: 14px; background: var(--panel); border: 1.5px solid var(--line); color: var(--ink-2); cursor: pointer; box-shadow: 0 1px 2px rgba(27,33,48,0.06); }
.pile-btn svg { width: 26px; height: 26px; fill: currentColor; }
.pile-btn__num { font-size: 26px; font-weight: 800; color: var(--ink); line-height: 1.1; }
.pile-btn__label { font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }

.end-wrap { position: absolute; right: 36px; bottom: 72px; display: flex; align-items: flex-end; gap: 14px; }
.end-btn { display: flex; align-items: center; gap: 12px; padding: 12px 26px 12px 16px; border-radius: 999px; border: 1.5px solid var(--line); background: var(--panel); font-size: 22px; font-weight: 800; color: var(--ink-2); cursor: pointer; box-shadow: 0 1px 2px rgba(27,33,48,0.06); }
.end-btn--ready { border-color: #e2a92a; color: var(--ink); box-shadow: 0 0 0 4px rgba(242,182,60,0.25); }
.end-btn:disabled { opacity: 0.45; }
.btn { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; font-weight: 900; font-size: 17px; color: #000; }
.btn--y { background: #ffd93d; }

.build-stamp { position: absolute; right: 36px; bottom: 48px; margin: 0; font-size: 12px; color: var(--ink-3); z-index: 21; cursor: pointer; }
.toast { position: absolute; left: 590px; top: 92px; transform: translateX(-50%); padding: 9px 20px; border-radius: 999px; background: #fff; border: 1.5px solid var(--line); font-size: 19px; font-weight: 700; z-index: 15; white-space: nowrap; box-shadow: 0 6px 20px rgba(27,33,48,0.15); }
.toast--bad { border-color: var(--red); color: var(--red); }
.toast--good { border-color: var(--green); color: #1d7a47; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, -14px); }
.toast-enter-active, .toast-leave-active { transition: all 200ms ease; }
</style>
