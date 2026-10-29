<template>
  <div class="stage-wrap">
    <div class="stage" :style="{ transform: `scale(${scale})` }">
      <template v-if="screen === 'game'">
        <TopBar
          :turn="turn" :population="population" :population-target="POPULATION_TARGET" :jobs="jobs" :revenue="nextBudget"
          :statuses="statuses" :disaster-in="disasterIn" :headed-off="headedOff"
        />

        <div class="board-wrap" :class="{ shake: shakeBoard }">
          <CityBoard
            :grid="game.state.cityGrid" :structures="game.state.builtStructures" :tick="tick"
            :targeting="mode === 'target'" :valid-cells="validCells" :cursor="cursor" :preview-card="selectedCard"
            @cell="onCellClick"
          />
        </div>

        <Market
          :city-row="cityRow" :goal-row="goalRow" :catalog="game.catalog" :treasury="treasury"
          :active="mode === 'market'" :focus="market" :goal-met="goalMet" :goal-expires-in="goalExpiresIn" :goals-left="goalsLeft"
          @focus="onMarketFocus" @select="onMarketSelect"
        />

        <div class="phase-tag" :class="`phase-tag--${phaseName}`">{{ phaseLabel }}</div>

        <CardInfo v-if="mode === 'hand' || mode === 'civic' || mode === 'target'" :card="focusedHandCard" :catalog="game.catalog" />

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
          <button class="end-btn" :class="{ 'end-btn--ready': canEndPhase }" :disabled="!canEndPhase" @click="act('confirm')">
            <span class="btn btn--y">Y</span>
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
          :focused-index="mode === 'market' ? null : handIndex" :picks="picks" :dim="mode === 'market'" :can-play="canPlay"
          @focus="onHandFocus" @select="onHandSelect"
        />

        <transition name="toast">
          <div v-if="toast" :key="toast.id" class="toast" :class="`toast--${toast.kind}`">{{ toast.text }}</div>
        </transition>

        <PileView v-if="mode === 'pile'" :tabs="pileTabs" :tab-index="pileTab" :focus-index="pileIndex" :catalog="game.catalog" @tab="pileTab = $event; pileIndex = 0" @focus="pileIndex = $event" />

        <Overlay v-if="mode === 'summary'" kind="summary" eyebrow="Overnight" :title="summary.title" :lines="summary.lines" hint="Continue" />
        <Overlay v-if="mode === 'over'" :kind="game.state.gameStatus" :eyebrow="`Turn ${turn}`" :title="game.state.gameStatus === 'won' ? 'City complete' : 'Out of goals'" :lines="overLines" hint="New game" />
        <Overlay v-if="mode === 'menu'" kind="plain" title="Paused" :items="MENU_ITEMS" :index="menuIndex" hint="Choose" @pick="menuIndex = $event; act('select')" />
      </template>

      <Overlay v-if="screen === 'title'" kind="title" eyebrow="A deck-building city builder" title="Deck City" :lines="['Build a city of 20 people before the goals run out.', 'Press Enter or click to start full screen.']" hint="Start" @click="act('select', 'click')" />

      <ButtonLegend :items="legend" :pad-connected="padConnected" />
      <p class="build-stamp" role="button" tabindex="0" title="Tap to reload" @click="stampTap">{{ refreshing ? 'reloading…' : stamp }}</p>
    </div>
    <BugReportButton v-if="firebaseConfigured" />
    <BugResolutionNotice v-if="firebaseConfigured" />
  </div>
</template>

<script>
import TopBar from '@/components/TopBar.vue'
import CityBoard from '@/components/CityBoard.vue'
import Market from '@/components/Market.vue'
import Hand from '@/components/Hand.vue'
import PileView from '@/components/PileView.vue'
import Overlay from '@/components/Overlay.vue'
import ButtonLegend from '@/components/ButtonLegend.vue'
import CardInfo from '@/components/CardInfo.vue'
import {
  createGame, starterCards, facilityCards, goalCards, disasterCards,
  calcStatTotal, countCardsByTag, evaluateCondition, isCellEmpty, isBuildable
} from '@/game/core'
import { attachInput } from '@/ui/input'
import BugReportButton from '@/components/shared/BugReportButton.vue'
import BugResolutionNotice from '@/components/shared/BugResolutionNotice.vue'
import { firebaseConfigured } from '@/firebase'
import { buildStamp, forceRefresh } from '@/utils/buildStamp'
import { initUpdateCheck } from '@/utils/checkForUpdate'
import { stepCursor, nearestCell } from '@/ui/layout'
import { ICONS } from '@/ui/icons'

const BASE_REVENUE = 4
const POPULATION_TARGET = 20
const MENU_ITEMS = ['Resume', 'New game']

export default {
  name: 'App',
  components: { TopBar, CityBoard, Market, Hand, PileView, Overlay, ButtonLegend, CardInfo, BugReportButton, BugResolutionNotice },
  // The house bug button has no store to read; it asks this for a snapshot.
  provide () {
    return { bugSnapshot: () => this.bugSnapshot() }
  },
  data () {
    return {
      POPULATION_TARGET,
      MENU_ITEMS,
      icons: ICONS,
      screen: 'title',
      game: null,
      tick: 0,
      scale: 1,
      padConnected: false,
      // hand | target | civic | market | pile | summary | over | menu
      mode: 'hand',
      handIndex: 0,
      selectedIndex: null,
      cursor: null,
      lastCursor: { x: 2, y: 1 },
      picks: [],
      market: { row: 0, index: 0 },
      pileTab: 0,
      pileIndex: 0,
      pileReturn: 'hand',
      menuIndex: 0,
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
    this.detach = attachInput({ onAction: this.act, onPadChange: (on) => { this.padConnected = on } })
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
    goalExpiresIn () { void this.tick; const r = (this.game.turnManager.turnNumber + 1) % 4; return r === 0 ? 0 : 4 - r },
    handKeys () {
      void this.tick
      const seen = {}
      return this.game.state.hand.map(card => { seen[card.id] = (seen[card.id] ?? 0) + 1; return `${card.id}#${seen[card.id]}` })
    },
    focusedHandCard () { void this.tick; return this.game.state.hand[this.handIndex] ?? null },
    selectedCard () { void this.tick; return this.selectedIndex === null ? null : this.game.state.hand[this.selectedIndex] ?? null },
    validCells () {
      void this.tick
      const card = this.selectedCard
      if (!card || this.mode !== 'target') return []
      const grid = this.game.state.cityGrid
      const out = []
      for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
          if (!isCellEmpty(grid, x, y)) continue
          if (card.placesRoad || card.skipsRoadRequirement || isBuildable(grid, x, y)) out.push({ x, y })
        }
      }
      return out
    },
    canEndPhase () { return this.mode === 'hand' || this.mode === 'market' },
    endLabel () { return this.phaseName === 'acquire' ? 'End turn' : 'Done building' },
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
      switch (this.screen === 'title' ? 'title' : this.mode) {
        case 'title': return [{ btn: 'A', label: 'Start' }]
        case 'hand': return [{ btn: '↔', label: 'Choose card' }, { btn: 'A', label: 'Play' }, { btn: 'Y', label: this.endLabel }, { btn: 'X', label: 'Deck' }, { btn: 'Start', label: 'Menu' }]
        case 'target': return [{ btn: '✥', label: 'Choose cell' }, { btn: 'A', label: 'Place' }, { btn: 'B', label: 'Back' }]
        case 'civic': return [{ btn: '↔', label: 'Choose' }, { btn: 'A', label: 'Mark to discard' }, { btn: 'B', label: 'Back' }]
        case 'market': return [{ btn: '✥', label: 'Browse' }, { btn: 'A', label: 'Buy / Claim' }, { btn: 'Y', label: 'End turn' }, { btn: 'X', label: 'Deck' }, { btn: 'Start', label: 'Menu' }]
        case 'pile': return [{ btn: 'LB', label: 'Prev' }, { btn: 'RB', label: 'Next' }, { btn: '✥', label: 'Browse' }, { btn: 'B', label: 'Close' }]
        case 'menu': return [{ btn: '✥', label: 'Choose' }, { btn: 'A', label: 'Pick' }, { btn: 'B', label: 'Resume' }]
        default: return [{ btn: 'A', label: 'Continue' }]
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
        populationTarget: POPULATION_TARGET
      })
      // The engine starts on 'draw'; running it deals the first hand and
      // lands on 'build', the first phase the player acts in.
      this.game.actions.advance()
      this.mode = 'hand'
      this.handIndex = 0
      this.selectedIndex = null
      this.cursor = null
      this.picks = []
      this.market = { row: 0, index: 0 }
      this.refresh()
    },

    // ----- input -----------------------------------------------------
    act (action, source = 'pad') {
      if (this.screen === 'title') {
        if (action === 'select' || action === 'confirm') {
          // A browser on a TV wants its chrome gone. Browsers only grant
          // full screen on a real user gesture, which a gamepad press is
          // not (Chrome, Safari), so this fires for the keyboard and the
          // mouse; a controller player presses Enter once, or taps Start.
          if (source !== 'pad') document.documentElement.requestFullscreen?.().catch(() => {})
          this.screen = 'game'
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
      else if (action === 'confirm') this.endBuild()
      else if (action === 'deck') this.openPile(0)
      else if (action === 'menu') this.openMenu()
    },
    in_target (action) {
      if (['up', 'down', 'left', 'right'].includes(action)) this.cursor = stepCursor(this.cursor, action, this.validCells)
      else if (action === 'select') this.placeAt(this.cursor)
      else if (action === 'back') { this.mode = 'hand'; this.selectedIndex = null; this.cursor = null }
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
      else if (action === 'up' || action === 'down') {
        const next = row === 0 ? 1 : 0
        this.market = { row: next, index: Math.min(index, Math.max(0, rows[next].length - 1)) }
      } else if (action === 'select') this.buyOrClaim()
      else if (action === 'confirm') this.endTurn()
      else if (action === 'deck') this.openPile(1)
      else if (action === 'menu') this.openMenu()
    },
    in_pile (action) {
      const cards = this.pileTabs[this.pileTab].cards
      const cols = 8
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
      else if (action === 'back') this.mode = this.menuReturn
      else if (action === 'select') {
        if (MENU_ITEMS[this.menuIndex] === 'New game') this.newGame()
        else this.mode = this.menuReturn
      }
    },

    // ----- mouse -----------------------------------------------------
    onHandFocus (i) { if (this.mode === 'hand' || this.mode === 'civic') this.handIndex = i },
    onHandSelect (i) {
      if (this.mode === 'hand') { this.handIndex = i; this.tryPlay(i) } else if (this.mode === 'civic' && i !== this.selectedIndex) { this.handIndex = i; this.togglePick(i) }
    },
    onCellClick (cell) {
      if (this.mode !== 'target') return
      if (this.validCells.some(c => c.x === cell.x && c.y === cell.y)) { this.cursor = cell; this.placeAt(cell) }
    },
    onMarketFocus (f) { if (this.mode === 'market') this.market = f },
    onMarketSelect (f) { if (this.mode === 'market') { this.market = f; this.buyOrClaim() } },

    // ----- play ------------------------------------------------------
    canPlay (card) {
      if (this.phaseName !== 'build') return false
      if (card.type === 'status' || card.type === 'disaster') return false
      return (card.cost ?? 0) <= this.treasury
    },
    tryPlay (index) {
      const card = this.game.state.hand[index]
      if (!card) return
      if (card.type === 'status' || card.type === 'disaster') return this.refuse(`${card.name} can't be played. A facility has to clear it.`)
      if ((card.cost ?? 0) > this.treasury) return this.refuse(`${card.name} costs ${card.cost}. You have ${this.treasury}.`, 'orb')
      if (card.type === 'civic') {
        if (this.game.state.hand.length < 2) return this.refuse('Nothing else in hand to discard.')
        this.selectedIndex = index
        this.picks = []
        this.mode = 'civic'
        this.handIndex = index === 0 ? 1 : 0
        return
      }
      this.selectedIndex = index
      this.mode = 'target'
      if (!this.validCells.length) {
        this.mode = 'hand'; this.selectedIndex = null
        return this.refuse(card.placesRoad ? 'No empty cell left.' : 'No empty cell with a road. Build a Road first.', 'board')
      }
      this.cursor = nearestCell(this.lastCursor, this.validCells)
    },
    placeAt (cell) {
      const card = this.selectedCard
      if (!card) return
      try {
        this.game.actions.playCard(card.id, cell)
      } catch (err) {
        return this.refuse(err.message, 'board')
      }
      this.lastCursor = cell
      if (card.cost) this.pop(`-${card.cost}`, 'orb')
      if (card.stats?.population) this.pop(`+${card.stats.population} pop`, 'board', 'var(--green)')
      this.say(`${card.name} built.`)
      this.mode = 'hand'
      this.selectedIndex = null
      this.cursor = null
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
      this.menuReturn = this.mode
      this.menuIndex = 0
      this.mode = 'menu'
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
        context: { screen: this.screen, padConnected: this.padConnected, scale: this.scale }
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
      const at = where === 'orb' ? { x: 60, y: -20 } : { x: 700, y: 300 }
      const id = ++this.popId
      this.pops.push({ id, text, color, ...at })
      setTimeout(() => { this.pops = this.pops.filter(p => p.id !== id) }, 900)
    }
  }
}
</script>

<style scoped>
.board-wrap { position: absolute; left: 150px; top: 158px; }
.phase-tag { position: absolute; left: 150px; top: 122px; font-size: 22px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink-3); }
.phase-tag--acquire { color: var(--gold); }

.orb-wrap { position: absolute; left: 44px; bottom: 90px; display: flex; align-items: flex-end; gap: 18px; }
.orb { width: 170px; height: 170px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #ffe8a3, #ffb703 60%, #c47f00); color: #2e2000; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 0 0 8px rgba(255,209,102,0.18), 0 20px 50px rgba(0,0,0,0.6); }
.orb--empty { filter: grayscale(0.6) brightness(0.7); }
.orb__num { font-size: 84px; font-weight: 900; line-height: 1; }
.orb__label { font-size: 20px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; margin-top: 2px; }

.pile-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 120px; height: 120px; border-radius: 18px; background: rgba(255,255,255,0.06); border: 3px solid var(--line); color: var(--ink-2); cursor: pointer; }
.pile-btn svg { width: 36px; height: 36px; fill: currentColor; }
.pile-btn__num { font-size: 34px; font-weight: 800; color: var(--ink); line-height: 1.1; }
.pile-btn__label { font-size: 16px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }

.end-wrap { position: absolute; right: 44px; bottom: 90px; display: flex; align-items: flex-end; gap: 18px; }
.end-btn { display: flex; align-items: center; gap: 16px; padding: 18px 34px 18px 22px; border-radius: 999px; border: 4px solid var(--line); background: rgba(255,255,255,0.06); font-size: 32px; font-weight: 800; color: var(--ink-2); cursor: pointer; }
.end-btn--ready { border-color: #ffd93d; color: var(--ink); }
.end-btn:disabled { opacity: 0.4; }
.btn { display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; font-weight: 900; font-size: 24px; color: #000; }
.btn--y { background: #ffd93d; }

.build-stamp { position: absolute; right: 44px; bottom: 56px; margin: 0; font-size: 15px; color: var(--ink-3); z-index: 21; cursor: pointer; }
.toast { position: absolute; left: 560px; top: 118px; transform: translateX(-50%); padding: 14px 30px; border-radius: 999px; background: rgba(255,255,255,0.1); border: 3px solid var(--line); font-size: 28px; font-weight: 700; z-index: 15; white-space: nowrap; }
.toast--bad { border-color: var(--red); color: var(--red); background: rgba(255,90,95,0.12); }
.toast--good { border-color: var(--green); color: var(--green); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, -20px); }
.toast-enter-active, .toast-leave-active { transition: all 200ms ease; }
</style>
