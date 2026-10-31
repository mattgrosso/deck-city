<template>
  <div class="stage-wrap">
    <div class="stage" :style="{ transform: `translate(-50%, -50%) scale(${scale})` }">
      <template v-if="screen === 'game'">
        <TopBar
          :turn="turn" :week="game.state.week || 1" :population="population" :jobs="jobs" :revenue="nextBudget"
          :era="run ? run.era : 0" :patience="run ? run.patience : 0" :patience-start="run ? run.patienceStart : 0" :last-drain="run && run.lastDrain ? run.lastDrain.total : 0" :endless="run ? run.status === 'endless' : false"
          :statuses="statuses" :disaster-in="disasterIn" :headed-off="headedOff" :focus="mode === 'stats' ? STATS[statIndex].key : null"
        />

        <div class="board-wrap" :class="{ shake: shakeBoard }">
          <CityScene
            ref="scene"
            :grid="game.state.cityGrid" :structures="game.state.builtStructures" :tick="tick"
            :targeting="mode === 'target' || mode === 'look'" :valid-cells="validCells" :cursor="cursorCell"
            :valid-edges="validEdges" :cursor-edge="cursorEdge" :planned-edges="pendingEdges" :preview-card="mode === 'target' ? selectedCard : null" :ghost-cells="ghostCells"
            :width="1920" :height="1080" :rect="VIEW_RECT" :stage-scale="scale" :show-labels="mode === 'look'" :marks="aimPreview ? aimPreview.marks : []"
            @cell="onCellClick"
          />
        </div>

        <Market
          :city-row="cityRow" :goal-row="goalRow" :goal-timers="goalTimers" :catalog="game.catalog" :treasury="treasury" :state="game.state" :tick="tick" :buys="buys"
          :active="mode === 'market'" :focus="market" :goal-met="goalMet" :goals-left="goalsLeft"
          :mandate="run && run.status === 'playing' ? run.mandate : null" :supply="supply" :for-sale="forSale"
          @focus="onMarketFocus" @select="onMarketSelect"
        />

        <div class="phase-tag" :class="`phase-tag--${phaseName}`">{{ phaseLabel }}</div>

        <CardInfo v-if="mode === 'hand' || mode === 'civic' || (mode === 'target' && !aimPreview)" :card="focusedHandCard" :catalog="game.catalog" />
        <CardInfo v-if="marketSupplyCard" :card="marketSupplyCard" :catalog="game.catalog" />
        <PlacementPreview v-if="mode === 'target' && aimPreview" v-bind="aimPreview.panel" />
        <PolicyList v-if="mode !== 'target' && mode !== 'look' && mode !== 'stats'" :policies="policies" />
        <InfoPanel v-if="mode === 'look' && lookInfo" v-bind="lookInfo" />
        <InfoPanel v-if="mode === 'stats'" v-bind="statInfo" />
        <InfoPanel v-if="marketPolicy" eyebrow="Policy for sale" :title="marketPolicy.name" :lines="[marketPolicy.policy.text, `Costs ${marketPolicy.price} budget, not a buy. It stands for the rest of the run.`, 'One is for sale each era.']" />

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
          :focused-index="handActive ? handIndex : null" :picks="picks" :dim="!handActive" :can-play="canPlay" :cost-of="costOf"
          :lifted="mode === 'civic' || mode === 'combine' ? selectedIndex : null" :need="mode === 'civic' ? civicNeed : mode === 'combine' ? 1 : 0" :prompt="mode === 'combine' ? combinePrompt : civicPrompt" :confirm-glyph="glyphs.confirm" :confirm-label="mode === 'combine' ? 'Combine' : 'Discard these'"
          @focus="onHandFocus" @select="onHandSelect" @confirm="confirmPicks"
        />

        <transition name="toast">
          <div v-if="toast" :key="toast.id" class="toast" :class="`toast--${toast.kind}`">{{ toast.text }}</div>
        </transition>

        <PileView v-if="mode === 'pile'" :tabs="pileTabs" :tab-index="pileTab" :focus-index="pileIndex" :catalog="game.catalog" @tab="pileTab = $event; pileIndex = 0" @focus="pileIndex = $event" />

        <SummaryPanel v-if="mode === 'summary'" v-bind="summary" :glyph="glyphs.select" @click="act('select', 'click')" />
        <div v-if="mode === 'combineChoice' && combineOpts && combineOpts.length" class="overlay-mandate">
          <div class="overlay-mandate__eyebrow">Combine · {{ combinePair[0].name }} + {{ combinePair[1].name }}</div>
          <div class="overlay-mandate__lede">Costs {{ combinePrice }} budget. Both cards leave your deck for good; the new one goes to your discard pile.</div>
          <div class="overlay-mandate__row">
            <div v-for="(c, i) in combineOpts" :key="c.id" class="combo-tile" :class="{ 'combo-tile--on': i === comboIndex }" :style="{ '--c': FAMILIES[familyOf(c)].color, '--soft': FAMILIES[familyOf(c)].soft }" @mouseenter="comboIndex = i" @click="comboIndex = i; act('select', 'click')">
              <div class="combo-tile__head"><span class="combo-tile__cost">{{ c.cost }}</span>{{ c.name }}</div>
              <div class="combo-tile__fam">{{ FAMILIES[familyOf(c)].label }} · costs {{ c.cost }} to build</div>
              <div class="combo-tile__lean">Leans {{ FAMILIES[familyOf(c)].label.toLowerCase() }}: +1 {{ c.lean }}{{ c.lean === 'patience' ? ' a turn' : '' }}</div>
              <ul class="combo-tile__rules"><li v-for="(line, j) in rulesFor(c, game.catalog).filter(l => !l.endsWith(', combined.'))" :key="j">{{ line }}</li></ul>
            </div>
          </div>
          <div class="overlay-mandate__hint"><span class="btn-a">{{ glyphs.select }}</span> Combine into this · <span class="btn-a">{{ glyphs.back }}</span> Back</div>
        </div>
        <div v-if="mode === 'offer' && monthOffer.length" class="overlay-mandate">
          <div class="overlay-mandate__eyebrow">Month's end · a new card</div>
          <div class="overlay-mandate__lede">Keep one for your deck, free. Then the market is open.</div>
          <div class="overlay-mandate__row">
            <div v-for="(c, i) in monthOffer" :key="c.id + i" class="offer-card" :class="{ 'offer-card--on': i === offerIndex }" @mouseenter="offerIndex = i" @click="offerIndex = i; act('select', 'click')">
              <GameCard :card="c" :catalog="game.catalog" :focused="i === offerIndex" />
            </div>
            <div class="offer-skip" :class="{ 'offer-skip--on': offerIndex === monthOffer.length }" @mouseenter="offerIndex = monthOffer.length" @click="offerIndex = monthOffer.length; act('select', 'click')">Skip</div>
          </div>
          <div class="overlay-mandate__hint"><span class="btn-a">{{ glyphs.select }}</span> Keep this one</div>
        </div>
        <div v-if="mode === 'policy' && run && run.policyOffer && run.policyOffer.length" class="overlay-mandate">
          <div class="overlay-mandate__eyebrow">{{ run.policyReason || 'The council' }} · adopt a policy</div>
          <div class="overlay-mandate__lede">It stands for the rest of the run. Choose one.</div>
          <div class="overlay-mandate__row">
            <div v-for="(p, i) in run.policyOffer" :key="p.id" @mouseenter="policyIndex = i" @click="policyIndex = i; act('select', 'click')">
              <PolicyTile :policy="p" :focused="i === policyIndex" />
            </div>
          </div>
          <div class="overlay-mandate__hint"><span class="btn-a">{{ glyphs.select }}</span> Adopt</div>
        </div>
        <div v-if="mode === 'mandate'" class="overlay-mandate">
          <div class="overlay-mandate__eyebrow">Era {{ ['I', 'II', 'III'][run.era - 1] }} · choose your mandate</div>
          <div class="overlay-mandate__lede">The city will judge you on it at the election. Patience: {{ run.patienceStart }}. Fail it and you're out.</div>
          <div class="overlay-mandate__row">
            <div v-for="(m, i) in run.offer" :key="m.id" @mouseenter="mandateIndex = i" @click="mandateIndex = i; act('select', 'click')">
              <MandateTile :mandate="m" :state="game.state" :catalog="game.catalog" :tick="tick" :focused="i === mandateIndex" big />
            </div>
          </div>
          <div class="overlay-mandate__hint"><span class="btn-a">{{ glyphs.select }}</span> Choose</div>
        </div>
        <Overlay v-if="mode === 'election'" :kind="electionShown.passed ? 'won' : 'lost'" :eyebrow="`Era ${['I', 'II', 'III'][electionShown.era - 1]} · election${electionShown.early ? ' called early' : ''}`" :title="electionShown.passed ? 'Re-elected' : 'Voted out'" :lines="electionLines" hint="Continue" :glyph="glyphs.select" />
        <Overlay v-if="mode === 'over'" :kind="game.state.run.status === 'won' ? 'won' : 'lost'" :eyebrow="`Turn ${turn}`" :title="game.state.run.status === 'won' ? 'Three eras. A great city.' : 'The run is over'" :lines="overLines" :items="overItems" :index="overIndex" hint="Choose" :glyph="glyphs.select" @pick="overIndex = $event; act('select', 'click')" />
        <Overlay v-if="mode === 'menu'" kind="plain" title="Paused" :items="menuLabels" :index="menuIndex" hint="Choose" :glyph="glyphs.select" @pick="menuIndex = $event; act('select', 'click')" />
        <HowTo v-if="mode === 'howto'" :page="howtoPage" :glyphs="glyphs" />
      </template>

      <Overlay v-if="screen === 'title'" kind="title" eyebrow="A deck-building city builder" title="Deck City" :lines="['Three eras. Choose a mandate for each and meet it before the public runs out of patience.', 'Press A, Enter or click to start.']" hint="Start" :glyph="glyphs.select" @click="act('select', 'click')" />

      <div v-if="playtest.on && !['target', 'look', 'stats'].includes(mode)" class="pt" :class="`pt--${playtest.mic}`">
        <span class="pt__dot" />
        <span class="pt__state">{{ { phone: 'Playtest · listening on your phone', on: 'Playtest · listening', paused: 'Playtest · mic paused (press P twice)', denied: 'Playtest · the browser blocked the mic', unsupported: 'Playtest · this browser cannot transcribe', off: 'Playtest' }[playtest.mic] }} · {{ playtest.lines }} lines</span>
        <span v-if="playtest.heard" class="pt__heard">“{{ playtest.heard }}”</span>
      </div>
      <!-- The phone mic (mic.html): scan to listen from the phone; gone once a phone is connected. -->
      <div v-if="playtest.on && !playtest.phone && screen === 'game' && !['target', 'look', 'stats'].includes(mode)" class="pt-qr">
        <img src="/mic-qr.svg" alt="">
        <div><b>Phone mic</b><br>Scan to talk from your phone</div>
      </div>
      <transition name="toast">
        <div v-if="playtest.note" :key="playtest.note.at" class="pt-note"><span class="pt-note__who">Claude</span>{{ playtest.note.text }}</div>
      </transition>
      <button v-if="!isFullscreen && !touch" class="fs-btn" :class="{ 'fs-btn--title': screen === 'title' }" type="button" @click.stop="toggleFullscreen('click')">
        <svg viewBox="0 0 24 24"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /></svg>
        Full screen <span class="fs-btn__key">F</span>
      </button>
      <ButtonLegend :items="legend" :pad="pad" :touch="touch" @act="act($event, 'touch')" />
      <p class="build-stamp" role="button" tabindex="0" title="Tap to reload" @click="stampTap">{{ refreshing ? 'reloading…' : stamp }}</p>
    </div>
    <BugReportButton v-if="firebaseConfigured" />
    <BugResolutionNotice v-if="firebaseConfigured" />
  </div>
</template>

<script>
import { toRaw } from 'vue'
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
import MandateTile from '@/components/MandateTile.vue'
import PlacementPreview from '@/components/PlacementPreview.vue'
import PolicyList from '@/components/PolicyList.vue'
import SummaryPanel from '@/components/SummaryPanel.vue'
import PolicyTile from '@/components/PolicyTile.vue'
import GameCard from '@/components/GameCard.vue'
import { runGameOptions } from '@/game/runSetup'
import BugReportButton from '@/components/shared/BugReportButton.vue'
import BugResolutionNotice from '@/components/shared/BugResolutionNotice.vue'
import {
  createGame, effectiveCost, clearsOf, isInLimits, isWater,
  calcStatTotal, countCardsByTag, evaluateCondition, isBuildable, listConnectedEdges,
  previewPlacement, instanceStats, canCombine, canCombinePair, sizeOf, combineCost, combineOptions, calcBudget, calcUpkeep,
  isMultiTile, footprint, placementProblem, marketPrice, roadSegmentsOf, policyMod, policyPrice, slotCapacity, discardsNeeded
} from '@/game/core'
import { attachInput, GLYPHS } from '@/ui/input'
import { stepCursor, nearestCell } from '@/ui/layout'
import { rulesFor, FAMILIES, familyOf, effectText } from '@/ui/cardText'
import { ICONS } from '@/ui/icons'
import { firebaseConfigured } from '@/firebase'
import { playtest, startPlaytest, stopPlaytest, playtestAvailable, playtestWasOn } from '@/utils/playtest'
import { buildStamp, forceRefresh } from '@/utils/buildStamp'
import { initUpdateCheck } from '@/utils/checkForUpdate'

// The clear part of the stage (left of the market, above the hand) the city is framed into.
const VIEW_RECT = { x: 40, y: 90, w: 1130, h: 690 }
const SHORT = { population: 'pop', revenue: 'rev', jobs: 'jobs' }
const MENU_ITEMS = ['Resume', 'Full screen', 'Playtest mode', 'How to play', 'New game']
const HOWTO_SEEN = 'deck-city:howto-seen'

// The numbers along the top, in cursor order, and what each one means.
const STATS = [
  { key: 'population', title: 'Population', explain: (a) => [`${a.population} people live here.`, 'Houses add 2 each, more beside other houses. A claimed goal (a Monument) adds 1.'] },
  { key: 'jobs', title: 'Jobs', explain: (a) => [`${a.jobs} jobs for ${a.population} people. Shops give 2, factories 3.`, a.population > a.jobs ? `${a.population - a.jobs} people have no work: a Crime card joins your deck at the end of every turn this stays true.` : 'Everyone has work. Keep it that way as the city grows, or crime follows.'] },
  { key: 'budget', title: 'Next budget', explain: (a) => [`${a.nextBudget} next turn: ${a.revenue} revenue from your buildings, less ${a.upkeep} upkeep.`, `Upkeep is 1 a turn for every building after your first ${a.upkeepFree}. A combined building counts as one.`, ...(a.costRise ? [`This era every building costs ${a.costRise} more to build.`] : []), `Unspent budget is lost at the end of the turn${a.rolloverCap ? ` except up to ${a.rolloverCap} (City Bank)` : ''}.`] },
  { key: 'crime', title: 'Crime', explain: (a) => [`${a.crime} Crime card${a.crime === 1 ? '' : 's'} in your deck. A house adds one when built; unemployment adds one a turn.`, 'Play a Crime card from your hand into a Police Station with room and it leaves the game.'] },
  { key: 'trash', title: 'Trash', explain: (a) => [`${a.trash} Trash card${a.trash === 1 ? '' : 's'} in your deck. A shop adds one when built.`, 'Play a Trash card from your hand into a Sanitation Center with room and it leaves the game.'] },
  { key: 'pollution', title: 'Pollution', explain: (a) => [`${a.pollution} Pollution card${a.pollution === 1 ? '' : 's'} in your deck. A factory adds one when built.`, 'Play a Pollution card from your hand into a Clinic with room and it leaves the game.'] },
  { key: 'patience', title: 'Public patience', explain: (a) => a.run?.status === 'endless' ? ['The run is won. No more elections: build what you like.'] : [`${Math.max(0, a.run.patience)} of ${a.run.patienceStart} left. At zero the election is held and your mandate, ${a.run.mandate?.name ?? 'once chosen'}, is judged.`, a.run.lastDrain ? `Last turn: ${a.run.lastDrain.parts.map(([l, v]) => `${l} ${v > 0 ? '−' : '+'}${Math.abs(v)}`).join(', ')}.` : 'Time, bad cards, unemployment and disasters wear it down; parks, culture and civic buildings slow that.', 'Met the mandate already? Pick it in the market to call the election early and carry half the patience left into the next era.'] },
  { key: 'disaster', title: 'Disaster clock', explain: (a) => [`Strikes in ${a.disasterIn} turn${a.disasterIn === 1 ? '' : 's'}. Strike ${a.strikes + 1} will shuffle ${a.strikes + 1} disaster card${a.strikes ? 's' : ''} into your deck; each bites when drawn.`, a.blockers ? `${a.blockers} Fire Station${a.blockers === 1 ? '' : 's'} standing: each blocks one card per strike.` : 'A Fire Station blocks one card per strike. Strikes get bigger, so build more over time.'] }
]

export default {
  name: 'App',
  components: { TopBar, CityScene, Market, Hand, GameCard, PileView, Overlay, ButtonLegend, CardInfo, InfoPanel, HowTo, MandateTile, PlacementPreview, SummaryPanel, PolicyList, PolicyTile, BugReportButton, BugResolutionNotice },
  // The house bug button has no store to read; it asks this for a snapshot.
  provide () {
    return { bugSnapshot: () => this.bugSnapshot() }
  },
  data () {
    return {
      VIEW_RECT,
      MENU_ITEMS,
      FAMILIES,
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
      pendingEdges: [],
      aimRotation: 0, // street segments laid so far by the Road card in hand
      lastAim: { x: 560, y: 420 },
      picks: [],
      comboIndex: 0,
      policyIndex: 0,
      offerIndex: 0,
      policyReturn: null,
      // A touchscreen (an iPad): tap to pick, tap again to play; the legend becomes buttons.
      touch: typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches,
      market: { row: 0, index: 0 },
      statIndex: 0,
      pileTab: 0,
      pileIndex: 0,
      pileReturn: 'hand',
      menuIndex: 0,
      mandateIndex: 0,
      overIndex: 0,
      electionsSeen: 0,
      menuReturn: 'hand',
      howtoPage: 0,
      howtoReturn: 'hand',
      summary: { turn: 0, budget: { total: 0, parts: [] }, drain: null, events: [] },
      toast: null,
      toastId: 0,
      pops: [],
      popId: 0,
      shakeBoard: false,
      shakeOrb: false,
      firebaseConfigured,
      stamp: buildStamp(),
      refreshing: false,
      isFullscreen: false,
      playtest
    }
  },
  created () {
    this.newGame()
  },
  mounted () {
    this.fit()
    window.addEventListener('resize', this.fit)
    this.onFsChange = () => { this.isFullscreen = !!document.fullscreenElement }
    document.addEventListener('fullscreenchange', this.onFsChange)
    this.onFsChange()
    this.detach = attachInput({ onAction: this.act, onPadChange: (kind) => { this.pad = kind } })
    // Touch or not follows the last thing used: a finger turns tap-twice on, a mouse or a key turns it off.
    this.onPointer = (e) => { this.touch = e.pointerType === 'touch' || e.pointerType === 'pen' }
    window.addEventListener('pointerdown', this.onPointer, true)
    // Auto-update (house standard): a reload only on the title screen or a
    // finished game - a game in progress lives in memory and nowhere else.
    const self = this
    initUpdateCheck({ get state () { return { game: self.screen === 'game' ? self.game.state : null } } })
    // A reload mid-playtest carries on the same transcript.
    if (playtestWasOn()) startPlaytest(this.playtestWhere)
  },
  beforeUnmount () {
    window.removeEventListener('resize', this.fit)
    document.removeEventListener('fullscreenchange', this.onFsChange)
    window.removeEventListener('pointerdown', this.onPointer, true)
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
    policies () { void this.tick; return this.game.state.policies ?? [] },
    /** The pause menu as shown: Playtest mode says whether it is on. */
    menuLabels () { return MENU_ITEMS.map(i => (i === 'Playtest mode' ? `Playtest mode: ${this.playtest.on ? 'on' : 'off'}` : i)) },
    nextBudget () { void this.tick; return calcBudget(this.game.state) },
    monthOffer () { void this.tick; return this.game.state.monthOffer ?? [] },
    run () { void this.tick; return this.game.state.run ?? null },
    supply () { void this.tick; return this.game.supply ?? [] },
    /** The policy for sale beside the city row (cards/policies.js), as a row item. */
    forSale () { void this.tick; const p = this.game.state.policyForSale; return p ? [{ id: '__policy__', isPolicy: true, policy: p, name: p.name, price: policyPrice(this.game.state) }] : [] },
    /** The policy for sale, while the market cursor is on it. */
    marketPolicy () { return this.mode === 'market' && this.market.row === 3 ? (this.row3[this.market.index]?.isPolicy ? this.row3[this.market.index] : null) : null },
    /** The market's first row is the city row; row 3 is what's always for sale (the supply, then the policy). */
    row0 () { return this.cityRow },
    row3 () { return [...this.supply, ...this.forSale] },
    /** The supply card under the market cursor, shown big on the left like a hand card. */
    marketSupplyCard () { if (this.mode !== 'market' || this.market.row !== 3) return null; const it = this.row3[this.market.index]; return it && !it.isPolicy ? it : null },
    electionShown () { void this.tick; return this.game.state.run?.election ?? { era: 1, passed: false } },
    electionLines () {
      const e = this.electionShown
      const run = this.game.state.run
      if (!e.mandate) return []
      const lines = [`Your mandate was ${e.mandate.name}. ${e.passed ? 'The city says you delivered.' : 'The city says you did not deliver.'}`]
      if (!e.passed) lines.push(`Population ${this.population} on turn ${this.turn}.`)
      else if (run.status === 'won') lines.push('That was the third era. The run is won.')
      else lines.push(`Era ${['I', 'II', 'III'][run.era - 1]} begins: the city limits widen and tier ${['I', 'II', 'III'][run.era - 1]} buildings join the market.${e.early ? ' You called it early, so half the patience you had left carries over.' : ''}`)
      return lines
    },
    overItems () { void this.tick; return this.game.state.run?.status === 'won' ? ['Keep building', 'New game'] : ['New game'] },
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
    buys () { void this.tick; return this.game.state.buys ?? 0 },
    handKeys () {
      void this.tick
      const seen = {}
      return this.game.state.hand.map(card => { seen[card.id] = (seen[card.id] ?? 0) + 1; return `${card.id}#${seen[card.id]}` })
    },
    /** The two cards being combined: the lifted one and the one picked. */
    combinePair () {
      void this.tick
      if ((this.mode !== 'combine' && this.mode !== 'combineChoice') || this.selectedIndex == null || this.picks.length !== 1) return null
      return [this.game.state.hand[this.selectedIndex], this.game.state.hand[this.picks[0]]]
    },
    combineOpts () { return this.combinePair ? combineOptions(toRaw(this.combinePair[0]), toRaw(this.combinePair[1]), this.game.catalog) : null },
    combinePrice () { return this.combinePair ? Math.max(0, combineCost(this.combinePair[0], this.combinePair[1]) - policyMod(this.game.state, 'combineDiscount')) : 0 },
    combinePrompt () {
      if (this.mode !== 'combine' || !this.selectedCard) return ''
      return this.combinePair ? `Combine for ${this.combinePrice} budget` : `${this.selectedCard.name}: pick a building to combine it with`
    },
    civicNeed () { void this.tick; return this.selectedCard ? discardsNeeded(this.selectedCard) : 2 },
    civicPrompt () {
      if (this.mode !== 'civic' || !this.selectedCard) return ''
      const left = this.civicNeed - this.picks.length
      return left > 0 ? `${this.selectedCard.name}: pick ${left} more to discard` : `${this.selectedCard.name}: discard these, then draw ${(this.selectedCard.effects?.onPlay ?? []).find(e => e.type === 'drawCards')?.amount ?? 0}`
    },
    handActive () { return this.mode === 'hand' || this.mode === 'civic' || this.mode === 'combine' || this.mode === 'target' },
    focusedHandCard () { void this.tick; return this.game.state.hand[this.handIndex] ?? null },
    selectedCard () { void this.tick; return this.selectedIndex === null ? null : this.game.state.hand[this.selectedIndex] ?? null },
    currentTarget () { return this.targets[this.targetIndex] ?? null },
    validCells () { return this.mode === 'target' ? this.targets.filter(t => t.kind === 'cell').map(t => ({ x: t.x, y: t.y })) : [] },
    validEdges () { return this.mode === 'target' ? this.targets.filter(t => t.kind === 'edge').map(t => t.key) : [] },
    /** Every plot the building being aimed would cover. */
    ghostCells () {
      const c = this.cursorCell
      if (this.mode !== 'target' || !c || !this.selectedCard || this.selectedCard.placesRoad) return []
      return footprint(this.selectedCard, c, this.aimRotation)
    },
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
      if (!inst && isWater(this.game.state.cityGrid, t.x, t.y)) return { eyebrow: 'Water', title: `Plot ${t.x + 1}, ${t.y + 1}`, lines: ['Nothing can be built on water. A Road can bridge it.', 'A home beside water: +1 people. A shop: +1 revenue.'] }
      if (!inst) return { eyebrow: 'Empty plot', title: `Plot ${t.x + 1}, ${t.y + 1}`, lines: [isBuildable(this.game.state.cityGrid, t.x, t.y) ? 'Touches a street: you can build here.' : 'No street yet. Lay a Road beside it first.'] }
      const st = instanceStats(this.game.state, inst)
      const now = Object.entries(st.total).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(', ')
      const lines = [now ? `Gives ${now} here.` : 'Gives nothing here.']
      for (const r of st.reasons) lines.push(`${r.amount > 0 ? '+' : '−'}${Math.abs(r.amount)} ${r.stat}: ${r.tag === 'policy' ? `from ${r.policy}` : r.tag === 'water' ? 'on the waterfront' : `${r.count} ${this.game.catalog[r.tag]?.name ?? r.tag} next door`}.`)
      lines.push(...rulesFor(inst.card, this.game.catalog).slice(1))
      if (inst.slots) lines.push(`${inst.slots.used} of ${slotCapacity(this.game.state, inst)} full.`)
      return { eyebrow: FAMILIES[familyOf(inst.card)].label, title: inst.card.name, lines, tone: inst.card.type === 'goal' ? 'gold' : 'plain' }
    },
    /** What the aimed spot is worth and what changes next door (the adjacency decision). */
    aimPreview () {
      void this.tick
      const card = this.selectedCard
      const t = this.currentTarget
      if (this.mode !== 'target' || !card || card.placesRoad || !t || t.kind !== 'cell') return null
      // toRaw: the preview stands the building in for a moment; on the reactive
      // proxy that write would re-run this computed forever.
      const p = previewPlacement(toRaw(this.game).state, toRaw(card), { x: t.x, y: t.y }, this.aimRotation)
      const stat = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${v > 0 ? '+' : '−'}${Math.abs(v)} ${SHORT[k] ?? k}`).join(', ')
      const tagName = (tag) => this.game.catalog[tag]?.name ?? tag
      const reasons = p.ownReasons.map(r => ({
        stat: r.stat,
        amount: r.amount,
        label: r.tag === 'policy' ? r.policy : r.tag === 'water' ? 'Waterfront' : r.scope === 'city' ? `${r.count} ${tagName(r.tag)} in the city` : `${r.count} ${tagName(r.tag)} next door`
      }))
      const marks = p.neighbours.map(n => ({ x: n.position.x, y: n.position.y, text: stat(n.delta), tone: Object.values(n.delta).some(v => v < 0) ? 'bad' : 'good' }))
      // The panel sits top-left; it drops lower when the cursor is under it.
      const low = t.sx < 470 && t.sy < 640
      return { panel: { name: card.name, base: card.stats ?? {}, reasons, neighbours: p.neighbours.map(n => ({ name: n.name, delta: n.delta })), own: p.own, delta: p.delta, also: [...(card.effects?.onBuild ?? []).map(e => effectText(e, this.game.catalog))], low }, marks }
    },
    statInfo () {
      void this.tick
      const stat = STATS[this.statIndex]
      const about = {
        population: this.population, jobs: this.jobs, nextBudget: this.nextBudget, revenue: calcStatTotal(this.game.state, 'revenue'), upkeep: calcUpkeep(this.game.state), upkeepFree: this.game.state.upkeep?.free ?? 0, costRise: this.game.state.costRise ?? 0, rolloverCap: this.game.state.treasuryRolloverCap,
        crime: this.statuses[0].count, trash: this.statuses[1].count, pollution: this.statuses[2].count,
        disasterIn: this.disasterIn, headedOff: this.headedOff, run: this.game.state.run,
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
      const passed = (s.run?.elections ?? []).filter(e => e.passed).map(e => e.mandate.name)
      const lines = [`Population ${this.population} with ${s.builtStructures.length} buildings on turn ${this.turn}.`]
      if (passed.length) lines.push(`Mandates delivered: ${passed.join(', ')}.`)
      if (s.run?.status === 'won') lines.push('Keep building in an endless city, or start a new run.')
      return lines
    },
    legend () {
      const L = (action, label) => ({ action, label })
      switch (this.screen === 'title' ? 'title' : this.mode) {
        case 'title': return [L('select', 'Start')]
        case 'hand': return [L('lr', 'Choose card'), L('select', 'Play'), ...(canCombine(this.focusedHandCard) ? [L('combine', 'Combine')] : []), L('up', 'Look at the city'), L('stats', 'Top bar'), L('confirm', this.endLabel), L('deck', 'Deck'), L('menu', 'Menu')]
        case 'target': return this.pendingEdges.length ? [L('dpad', 'Aim the second segment'), L('select', 'Place'), L('back', 'Keep just one')] : [L('dpad', 'Aim'), ...(isMultiTile(this.selectedCard) ? [L('prevPile', 'Turn'), L('nextPile', 'Turn')] : []), L('select', 'Place'), L('back', 'Back')]
        case 'combine': return [L('lr', 'Choose'), L('select', 'Pick / put back'), ...(this.picks.length ? [L('confirm', 'Combine')] : []), L('back', 'Back')]
        case 'combineChoice': return [L('lr', 'Choose'), L('select', 'Combine into this'), L('back', 'Back')]
        case 'civic': return [L('lr', 'Choose'), L('select', 'Pick / put back'), ...(this.picks.length >= this.civicNeed ? [L('confirm', 'Discard these')] : []), L('back', 'Back')]
        case 'market': return [L('dpad', 'Browse'), L('select', 'Buy / Claim'), L('up', 'Look at the city'), L('stats', 'Top bar'), L('confirm', 'End turn'), L('deck', 'Deck'), L('menu', 'Menu')]
        case 'look': return [L('dpad', 'Move'), L('up', 'Top bar'), L('back', 'Back')]
        case 'stats': return [L('lr', 'Next number'), L('back', 'Back')]
        case 'pile': return [L('prevPile', 'Prev'), L('nextPile', 'Next'), L('dpad', 'Browse'), L('back', 'Close')]
        case 'menu': return [L('dpad', 'Choose'), L('select', 'Pick'), L('back', 'Resume')]
        case 'howto': return [L('lr', 'Page'), L('select', 'Next'), L('back', 'Close')]
        case 'mandate': return [L('lr', 'Choose'), L('select', 'Take this mandate')]
        case 'policy': return [L('lr', 'Choose'), L('select', 'Adopt this policy')]
        case 'offer': return [L('lr', 'Choose'), L('select', 'Keep this one')]
        case 'over': return [L('dpad', 'Choose'), L('select', 'Pick')]
        default: return [L('select', 'Continue')]
      }
    }
  },
  methods: {
    fit () {
      this.scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
    },
    refresh () { this.tick++; this.offerPendingPolicy() },
    /** A policy earned mid-run (a goal, a milestone) opens its pick at once. */
    offerPendingPolicy () {
      if (!['hand', 'market'].includes(this.mode) || !this.game.state.run?.policyOffer?.length) return
      this.policyReturn = this.mode
      this.policyIndex = 0
      this.mode = 'policy'
    },
    newGame () {
      this.game = createGame(runGameOptions())
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
      this.mandateIndex = 0
      this.overIndex = 0
      this.electionsSeen = 0
      if (this.game.state.run?.status === 'choosing') this.toMandate()
      this.refresh()
    },
    /** A new era (or run): adopt a policy first if one is on offer, then choose the mandate. */
    toMandate () {
      this.mandateIndex = 0
      this.policyIndex = 0
      this.mode = this.game.state.run?.policyOffer?.length ? 'policy' : 'mandate'
    },
    in_offer (action) {
      const offer = this.game.state.monthOffer ?? []
      const n = offer.length + 1 // the cards, then Skip
      if (action === 'left' || action === 'up') this.offerIndex = (this.offerIndex + n - 1) % n
      else if (action === 'right' || action === 'down') this.offerIndex = (this.offerIndex + 1) % n
      else if (action === 'select' || action === 'confirm') {
        const pick = offer[this.offerIndex] ?? null
        this.game.actions.chooseOffer(pick ? pick.id : null)
        this.say(pick ? `${pick.name} joins your deck.` : 'Skipped this month\'s card.', pick ? 'good' : undefined)
        this.mode = 'market'
        this.refresh()
      } else if (action === 'menu') this.openMenu()
    },
    in_policy (action) {
      const offer = this.game.state.run.policyOffer ?? []
      const n = offer.length
      if (!n) { this.mode = 'mandate'; return }
      if (action === 'left' || action === 'up') this.policyIndex = (this.policyIndex + n - 1) % n
      else if (action === 'right' || action === 'down') this.policyIndex = (this.policyIndex + 1) % n
      else if (action === 'select' || action === 'confirm') {
        const p = offer[this.policyIndex]
        this.game.actions.choosePolicy(p.id)
        this.say(`Policy adopted: ${p.name}.`, 'good')
        this.policyIndex = 0
        // Another pick waiting? Stay. A new era? The mandate. Otherwise back to play.
        if (!this.game.state.run.policyOffer?.length) this.mode = this.game.state.run.status === 'choosing' ? 'mandate' : (this.policyReturn ?? 'hand')
        this.policyReturn = null
        this.tick++
      } else if (action === 'menu') this.openMenu()
    },
    enterFullscreen (source) {
      const el = document.documentElement
      if (!el.requestFullscreen) return
      el.requestFullscreen().catch(() => {
        const msg = source === 'pad' ? 'The browser won\'t go full screen from a controller. Press F or click Full screen.' : 'The browser refused full screen.'
        this.say(msg, 'bad') // the game has started by the time the browser answers
      })
    },
    toggleFullscreen (source) {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
      else this.enterFullscreen(source)
    },
    startGame () {
      this.screen = 'game'
      let seen = false
      try { seen = window.localStorage.getItem(HOWTO_SEEN) === '1' } catch { /* no storage */ }
      if (!seen) this.openHowTo(this.mode)
    },

    // ----- input -----------------------------------------------------
    act (action, source = 'pad') {
      this.lastSource = source
      if (action === 'fullscreen') return this.toggleFullscreen(source)
      if (action === 'playtest') return this.togglePlaytest()
      // One press to the top bar from the hand or the market, not a walk up the map.
      if (action === 'stats' && (this.mode === 'hand' || this.mode === 'market')) return this.openStats(this.mode)
      if (action === 'stats' && this.mode === 'stats') { this.mode = this.statsReturn; return }
      if (this.screen === 'title') {
        if (action === 'select' || action === 'confirm') {
          // Matt: "if I hit the button with a controller, it doesn't go to
          // full screen. If I click the mouse, it does." Browsers grant full
          // screen only to a click or a key press; a controller button is not
          // one (Chrome, Safari). Ask anyway - a browser that allows it wins -
          // and say so plainly when it refuses.
          if (!this.isFullscreen) this.enterFullscreen(source)
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
      else if (action === 'combine') this.startCombine(this.handIndex)
      else if (action === 'menu') this.openMenu()
    },
    in_combine (action) {
      const n = this.game.state.hand.length
      const others = [...Array(n).keys()].filter(i => i !== this.selectedIndex)
      const pos = Math.max(0, others.indexOf(this.handIndex))
      if (action === 'left') this.handIndex = others[(pos - 1 + others.length) % others.length]
      else if (action === 'right') this.handIndex = others[(pos + 1) % others.length]
      else if (action === 'select') this.toggleCombinePick(this.handIndex)
      else if (action === 'confirm' || action === 'combine') this.openCombineChoice()
      else if (action === 'back') this.cancelCombine()
    },
    in_combineChoice (action) {
      if (action === 'left' || action === 'right') this.comboIndex = (this.comboIndex + 1) % Math.max(1, this.combineOpts?.length ?? 1)
      else if (action === 'select') this.doCombine()
      else if (action === 'back') this.mode = 'combine'
    },
    in_target (action) {
      if (['up', 'down', 'left', 'right'].includes(action)) this.moveAim(action)
      else if (action === 'prevPile' || action === 'nextPile') this.turnAim(action === 'nextPile' ? 1 : -1)
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
      else if (action === 'confirm') this.confirmPicks()
      else if (action === 'back') { this.mode = 'hand'; this.picks = []; this.handIndex = this.selectedIndex; this.selectedIndex = null }
    },
    in_market (action) {
      const hasMandate = this.run?.status === 'playing'
      const rows = [this.row0, this.goalRow, hasMandate ? [this.run.mandate] : [], this.row3]
      const { row, index } = this.market
      const len = rows[row].length
      const clamp = (r, i) => Math.min(i, Math.max(0, rows[r].length - 1))
      if (action === 'left' && len) this.market = { row, index: (index - 1 + len) % len }
      else if (action === 'right' && len) this.market = { row, index: (index + 1) % len }
      else if (action === 'up' && row === 0) this.market = { row: 1, index: clamp(1, index) }
      else if (action === 'up' && row === 1 && hasMandate) this.market = { row: 2, index: 0 }
      else if (action === 'down' && row === 2) this.market = { row: 1, index: 0 }
      else if (action === 'down' && row === 1) this.market = { row: 0, index: clamp(0, index) }
      else if (action === 'down' && row === 0 && rows[3].length) this.market = { row: 3, index: clamp(3, index) }
      else if (action === 'up' && row === 3) this.market = { row: 0, index: clamp(0, index) }
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
      const n = this.overItems.length
      if (action === 'up' || action === 'left') this.overIndex = (this.overIndex + n - 1) % n
      else if (action === 'down' || action === 'right') this.overIndex = (this.overIndex + 1) % n
      else if (action === 'select' || action === 'confirm') {
        if (this.overItems[this.overIndex] === 'Keep building') {
          this.game.actions.keepBuilding()
          this.say('Endless city. No more elections: build what you like.', 'good')
          this.mode = 'hand'
          this.handIndex = 0
          this.refresh()
        } else this.newGame()
      }
    },
    in_mandate (action) {
      const n = this.game.state.run.offer.length
      if (action === 'left' || action === 'up') this.mandateIndex = (this.mandateIndex + n - 1) % n
      else if (action === 'right' || action === 'down') this.mandateIndex = (this.mandateIndex + 1) % n
      else if (action === 'select' || action === 'confirm') {
        const m = this.game.state.run.offer[this.mandateIndex]
        this.game.actions.chooseMandate(m.id)
        this.say(`Mandate: ${m.name}. Meet it before patience runs out.`, 'good')
        this.mode = this.game.turnManager.phases[this.game.turnManager.currentPhaseIndex].name === 'acquire' ? 'market' : 'hand'
        this.handIndex = 0
        this.mandateIndex = 0
        this.refresh()
      } else if (action === 'menu') this.openMenu()
    },
    in_election (action) {
      if (action !== 'select' && action !== 'confirm') return
      this.electionsSeen = this.game.state.run.elections.length
      const status = this.game.state.run.status
      if (status === 'choosing') this.toMandate(); else if (status === 'won' || status === 'lost') { this.overIndex = 0; this.mode = 'over' } else this.mode = 'hand'
      this.refresh()
    },
    in_menu (action) {
      if (action === 'up') this.menuIndex = (this.menuIndex + MENU_ITEMS.length - 1) % MENU_ITEMS.length
      else if (action === 'down') this.menuIndex = (this.menuIndex + 1) % MENU_ITEMS.length
      else if (action === 'back' || action === 'menu') this.mode = this.menuReturn
      else if (action === 'select') {
        const item = MENU_ITEMS[this.menuIndex]
        if (item === 'New game') this.newGame()
        else if (item === 'Full screen') { this.mode = this.menuReturn; this.toggleFullscreen(this.lastSource) } else if (item === 'Playtest mode') { this.mode = this.menuReturn; this.togglePlaytest() } else if (item === 'How to play') this.openHowTo(this.menuReturn)
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
      // Plots move along the board's own rows and columns (Matt, 2026-10-30:
      // "still awkward to move around" - on the angled board a screen "up" has
      // no plot straight above, so the cursor wandered). Each press takes the
      // grid direction whose on-screen direction best matches the press.
      if (here.kind === 'cell' && this.targets.every(t => t.kind === 'cell')) {
        const want = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir]
        const o = this.screenOf({ kind: 'cell', x: 0, y: 0 }); const ex = this.screenOf({ kind: 'cell', x: 1, y: 0 }); const ey = this.screenOf({ kind: 'cell', x: 0, y: 1 })
        const axes = [[1, 0, ex.x - o.x, ex.y - o.y], [-1, 0, o.x - ex.x, o.y - ex.y], [0, 1, ey.x - o.x, ey.y - o.y], [0, -1, o.x - ey.x, o.y - ey.y]]
        const [gx, gy] = axes.reduce((best, ax) => { const s = (ax[2] * want[0] + ax[3] * want[1]) / Math.hypot(ax[2], ax[3]); return s > best[2] ? [ax[0], ax[1], s] : best }, [0, 0, -Infinity])
        let pick = null; let score = Infinity
        this.targets.forEach((t, i) => {
          const along = (t.x - here.x) * gx + (t.y - here.y) * gy
          if (along <= 0) return
          const across = Math.abs((t.x - here.x) * gy) + Math.abs((t.y - here.y) * gx)
          const sc = along + across * 3 // the same row first, then the nearest row beside it
          if (sc < score) { score = sc; pick = i }
        })
        if (pick !== null) this.targetIndex = pick
        return
      }
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
    // Safari fires a hover on every tap: on a touchscreen hover means nothing, or a first tap would count as the second.
    onHandFocus (i) { if (this.touch) return; if (this.mode === 'hand' || this.mode === 'civic' || this.mode === 'combine') this.handIndex = i },
    onHandSelect (i) {
      if (this.mode === 'hand') {
        const again = this.handIndex === i
        this.handIndex = i
        if (!this.touch || again) this.tryPlay(i)
      } else if (this.mode === 'civic' && i !== this.selectedIndex) { this.handIndex = i; this.togglePick(i) } else if (this.mode === 'combine' && i !== this.selectedIndex) { this.handIndex = i; this.toggleCombinePick(i) }
    },
    onCellClick (cell) {
      // Outside aiming, tapping the city looks at what was tapped.
      if ((this.mode === 'hand' || this.mode === 'market') && cell.x != null) {
        this.openLook(this.mode)
        const at = this.targets.findIndex(t => t.x === cell.x && t.y === cell.y)
        if (at !== -1) this.targetIndex = at
        return
      }
      if (this.mode !== 'target' && this.mode !== 'look') return
      // The target nearest the tap: a street segment, or a plot (fingers are wide).
      let i = this.targets.findIndex(t => t.kind === 'cell' && t.x === cell.x && t.y === cell.y)
      if (i === -1 || this.targets[i].kind !== 'cell') {
        let best = Infinity
        this.targets.forEach((t, k) => { const d = Math.hypot(t.sx - cell.sx, t.sy - cell.sy); if (d < best) { best = d; i = k } })
        if (best > 140) return
      }
      if (i === -1) return
      // On a touchscreen the first tap aims (and shows the preview); a second on the same spot places.
      const again = i === this.targetIndex
      this.targetIndex = i
      if (this.mode === 'target' && (!this.touch || again)) this.placeAt(this.currentTarget)
    },
    onMarketFocus (f) { if (!this.touch && this.mode === 'market') this.market = f },
    onMarketSelect (f) {
      if (this.mode !== 'market') return
      const again = this.market.row === f.row && this.market.index === f.index
      this.market = f
      if (!this.touch || again) this.buyOrClaim()
    },

    // ----- play ------------------------------------------------------
    costOf (card) { void this.tick; return effectiveCost(this.game.state, card) },
    canPlay (card) {
      if (this.phaseName !== 'build') return false
      if (card.type === 'status') return !!this.slotFor(card)
      if (card.type === 'disaster') return false
      return this.costOf(card) <= this.treasury
    },
    /** The built facility that could take this status card right now, if any. */
    slotFor (card) {
      void this.tick
      return this.game.state.builtStructures.find(i => clearsOf(i.card).includes(card.id) && i.slots && i.slots.used < slotCapacity(this.game.state, i)) ?? null
    },
    clearerName (card) {
      return { crime: 'Police Station', trash: 'Sanitation Center', pollution: 'Clinic', debt: 'Bank Branch or Courthouse' }[card.id] ?? 'facility'
    },
    tryPlay (index) {
      const card = this.game.state.hand[index]
      if (!card) return
      if (card.type === 'disaster') return this.refuse(`${card.name} can't be played. It already bit when you drew it.`)
      if (card.type === 'status') {
        const slot = this.slotFor(card)
        if (!slot) return this.refuse(`No room for ${card.name}. Build a ${this.clearerName(card)}, or play another on a full one to add room.`)
        let took
        try { took = this.game.actions.clearStatus(card.id) } catch (err) { return this.refuse(err.message) }
        const into = took?.position ? took : slot
        this.say(`${into.card.name} took the ${card.name} card (${into.slots.used} of ${slotCapacity(this.game.state, into)} full).`, 'good')
        if (into.position) this.$refs.scene?.flashAt?.(into.position, 0x7fd38b)
        this.handIndex = Math.min(this.handIndex, Math.max(0, this.game.state.hand.length - 1))
        this.refresh()
        return
      }
      if (this.costOf(card) > this.treasury) return this.refuse(`${card.name} costs ${this.costOf(card)}. You have ${this.treasury}.`, 'orb')
      if (card.type === 'civic' && !(card.effects?.onPlay ?? []).some(e => e.type === 'discardCards')) {
        // A civic card with nothing to choose plays straight away.
        try { this.game.actions.playCivicCard(card.id) } catch (err) { return this.refuse(err.message) }
        this.say(`${card.name}: ${this.game.log.slice(-2).join(' ')}`, 'good')
        this.handIndex = Math.min(this.handIndex, Math.max(0, this.game.state.hand.length - 1))
        this.refresh()
        return
      }
      if (card.type === 'civic') {
        const need = discardsNeeded(card)
        if (this.game.state.hand.length - 1 < need) return this.refuse(`${card.name} needs ${need} other cards in your hand to discard.`)
        this.selectedIndex = index
        this.picks = []
        this.mode = 'civic'
        this.handIndex = index === 0 ? 1 : 0
        return
      }
      // The city picks the spot and lays any street it needs (Matt,
      // 2026-10-31: "you just play the card, the game picks the best spot
      // for it"; core/state/autoPlace.js). A Road card from an old save
      // still aims by hand.
      if (!card.placesRoad) {
        const before = this.game.state.builtStructures.length
        let built
        try { built = this.game.actions.playCard(card.id) } catch (err) { return this.refuse(err.message, 'board') }
        const upgraded = this.game.state.builtStructures.length === before
        this.afterPlay(card, upgraded ? this.game.log.slice(-1)[0] : `${card.name} built.`)
        if (built?.position) this.$refs.scene?.flashAt?.(built.position)
        return
      }
      this.pendingEdges = []
      const targets = listConnectedEdges(this.game.state.cityGrid).map(e => ({ id: e.key, kind: 'edge', key: e.key }))
      if (!targets.length) return this.refuse('Nowhere left to lay a street.', 'board')
      this.selectedIndex = index
      this.targets = this.withScreen(targets)
      this.aimNearest(this.lastAim)
      this.mode = 'target'
    },
    /** Every anchor plot where `card` fits, turned `rotation` (state/shapes.js). */
    cellTargets (card, rotation) {
      const s = toRaw(this.game).state
      const out = []
      for (let y = 0; y < s.cityGrid.height; y++) for (let x = 0; x < s.cityGrid.width; x++) if (!placementProblem(s, toRaw(card), { x, y }, rotation)) out.push({ id: `${x},${y}`, kind: 'cell', x, y })
      return out
    },
    /** Turn a multi-tile building a quarter (LB / RB), keeping the cursor near where it was. */
    turnAim (step) {
      const card = this.selectedCard
      if (!card || !isMultiTile(card)) return
      const here = this.currentTarget
      for (let k = 1; k <= 4; k++) {
        const r = (this.aimRotation + step * k + 8) % 4
        const targets = this.cellTargets(card, r)
        if (!targets.length) continue
        this.aimRotation = r
        this.targets = this.withScreen(targets)
        this.aimNearest(here ? { x: here.sx, y: here.sy } : this.lastAim)
        return
      }
    },
    placeAt (target) {
      const card = this.selectedCard
      if (!card || !target) return
      if (target.kind === 'edge') {
        // A Road lays up to two segments: aim the next one from the streets
        // so far, or commit when the card is spent.
        const edges = [...this.pendingEdges, target.key]
        this.lastAim = { x: target.sx, y: target.sy }
        if (edges.length < roadSegmentsOf(this.game.state, card)) {
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
        this.game.actions.playCard(card.id, { x: target.x, y: target.y, rotation: this.aimRotation })
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
      if (card.cost) this.pop(`-${card.cost}`, 'orb') // printed cost; the orb itself shows what was spent
      if (card.stats?.population) this.pop(`+${card.stats.population} pop`, 'board', 'var(--green)')
      this.say(message)
      this.mode = 'hand'
      this.selectedIndex = null
      this.targets = []
      this.handIndex = Math.min(this.handIndex, Math.max(0, this.game.state.hand.length - 1))
      this.refresh()
    },
    // ----- combining (core/cards/combine.js) ----------------------------
    familyOf (card) { return familyOf(card) },
    rulesFor (card, catalog) { return rulesFor(card, catalog) },
    startCombine (i) {
      const card = this.game.state.hand[i]
      if (!canCombine(card)) return this.refuse(card ? `${card.name} can't be combined: only buildings, not Roads or one-of-a-kinds.` : 'No card.')
      const others = this.game.state.hand.map((c, j) => j).filter(j => j !== i && canCombinePair(card, this.game.state.hand[j]))
      if (!others.length) return this.refuse(sizeOf(card) > 1 ? `${card.name} combines only with another ${sizeOf(card) === 2 ? 'combined pair' : `building of ${sizeOf(card)}`}.` : 'Nothing else in your hand to combine it with.')
      this.selectedIndex = i
      this.picks = []
      this.handIndex = others[0]
      this.mode = 'combine'
    },
    toggleCombinePick (i) {
      if (this.picks[0] === i) { this.picks = []; return }
      if (!canCombinePair(this.game.state.hand[this.selectedIndex], this.game.state.hand[i])) return this.refuse(`${this.game.state.hand[i]?.name ?? 'That'} can't combine with ${this.selectedCard.name}: only the same size, two singles or two pairs.`)
      this.picks = [i]
    },
    openCombineChoice () {
      if (this.mode !== 'combine' || this.picks.length !== 1) return this.refuse(`Pick a building to combine it with first (${this.glyphs.select}).`)
      if (this.treasury < this.combinePrice) return this.refuse(`Combining these costs ${this.combinePrice} budget.`)
      this.comboIndex = 0
      this.mode = 'combineChoice'
    },
    doCombine () {
      const [a, b] = this.combinePair
      try {
        const made = this.game.actions.combineCards(a.id, b.id, this.comboIndex)
        this.pop(`-${this.combinePrice}`, 'orb')
        this.say(`${a.name} + ${b.name}: ${made.name}, in your discard pile.`, 'good')
      } catch (err) {
        this.refuse(err.message)
      }
      this.cancelCombine()
      this.handIndex = 0
      this.refresh()
    },
    cancelCombine () {
      this.mode = 'hand'
      if (this.selectedIndex != null) this.handIndex = this.selectedIndex
      this.picks = []
      this.selectedIndex = null
    },
    togglePick (i) {
      const at = this.picks.indexOf(i)
      if (at !== -1) { this.picks.splice(at, 1); return }
      if (this.picks.length >= this.civicNeed) return this.refuse(`That's ${this.civicNeed}. Press ${this.glyphs.select} on a picked card to put it back, or ${this.glyphs.confirm} to discard.`)
      this.picks.push(i)
    },
    /** Play the civic card with the cards picked to discard (Y, or the button). */
    confirmPicks () {
      if (this.mode === 'combine') return this.openCombineChoice()
      if (this.mode !== 'civic' || this.picks.length < this.civicNeed) return
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
      // Month's end: three cards offered, one kept free (core game.js chooseOffer).
      if (this.game.state.monthOffer?.length) { this.offerIndex = 0; this.mode = 'offer' }
      const firstAffordable = this.cityRow.findIndex(c => marketPrice(this.game.state, c) <= this.treasury)
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
      if (row === 2) return this.callElection()
      if (row === 0 || row === 3) {
        const card = (row === 3 ? this.row3 : this.row0)[index]
        if (!card) return
        if (card.isPolicy) {
          if (card.price > this.treasury) return this.refuse(`${card.name} costs ${card.price}. You have ${this.treasury}.`, 'orb')
          try { this.game.actions.buyPolicy() } catch (err) { return this.refuse(err.message) }
          this.pop(`-${card.price}`, 'orb')
          this.say(`Policy adopted: ${card.name}.`, 'good')
          this.refresh()
          return
        }
        const price = marketPrice(this.game.state, card)
        if ((this.game.state.buys ?? 0) < 1) return this.refuse('No buys left this turn. A Trade Fair gives another.')
        if (price > this.treasury) return this.refuse(`${card.name} sells for ${price}. You have ${this.treasury}.`, 'orb')
        try { this.game.actions.acquireCard(card.id) } catch (err) { return this.refuse(err.message) }
        if (price) this.pop(`-${price}`, 'orb')
        this.say(`${card.name} added to your deck.`)
      } else {
        const goal = this.goalRow[index]
        if (!goal) return
        if (!this.goalMet(goal)) return this.refuse(`${goal.name} isn't ready yet.`)
        try { this.game.actions.claimGoal(goal.id) } catch (err) { return this.refuse(err.message) }
        this.say(`${goal.name} claimed. It's a Monument in your deck now.`, 'good')
      }
      const rows = [this.row0, this.goalRow, [], this.row3]
      this.market = { row, index: Math.min(index, Math.max(0, rows[row].length - 1)) }
      this.refresh()
    },
    callElection () {
      const run = this.game.state.run
      if (!run || run.status !== 'playing') return
      if (!this.goalMet(run.mandate)) return this.refuse(`${run.mandate.name} isn't met yet. The election comes when patience runs out.`)
      try { this.game.actions.callElection() } catch (err) { return this.refuse(err.message) }
      this.mode = 'election'
      this.refresh()
    },
    endTurn () {
      const before = this.game.log.length
      // acquire -> endOfTurn -> cleanup -> draw -> build: four steps, the
      // last of which deals the next hand.
      for (let i = 0; i < 4; i++) this.game.actions.advance()
      const lines = this.game.log.slice(before)
      this.refresh()
      // The ledger: the budget and patience as numbers, everything else as events.
      const s = this.game.state
      const events = lines
        .filter(l => !l.startsWith('Budget this turn') && !l.startsWith('Patience '))
        .map(text => ({ text, bad: /disaster|flood|fire|blackout|strike|crime|pollution|trash|debt|voted out|leaves|expired|gone/i.test(text) && !/cleared|took a|blocked/i.test(text) }))
      this.summary = { turn: this.turn, budget: s.lastBudget ?? { total: this.treasury, parts: [] }, drain: s.run?.lastDrain ?? null, patience: s.run?.patience ?? 0, patienceStart: s.run?.patienceStart ?? 0, events }
      this.mode = 'summary'
    },
    afterSummary () {
      const run = this.game.state.run
      if (run && run.elections.length > this.electionsSeen) { this.mode = 'election'; return }
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
      for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) if (isInLimits(grid, x, y)) targets.push({ id: `${x},${y}`, kind: 'cell', x, y })
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
          run: s.run ? { era: s.run.era, status: s.run.status, patience: s.run.patience, mandate: s.run.mandate?.id ?? null } : null,
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
    // ----- playtest mode (utils/playtest.js) -----------------------------
    togglePlaytest () {
      if (!playtestAvailable()) return this.say('Playtest mode needs the database, which this build has not got.', 'bad')
      if (playtest.on) { stopPlaytest(); this.say('Playtest mode off.') } else { startPlaytest(this.playtestWhere); this.say('Playtest mode on: talk as you play.', 'good') }
    },
    /** Where the game was when a line was said, so the transcript reads in context. */
    playtestWhere () {
      const s = this.game.state
      const run = s.run
      return {
        turn: this.turn,
        era: run?.era ?? null,
        patience: run?.patience ?? null,
        mandate: run?.mandate?.name ?? null,
        phase: this.phaseName,
        mode: this.mode,
        screen: this.screen,
        budget: this.treasury,
        population: this.population,
        hand: s.hand.map(c => c.name).join(', '),
        card: this.selectedCard?.name ?? this.focusedHandCard?.name ?? null
      }
    },
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
.overlay-mandate { position: absolute; inset: 0; z-index: 40; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; background: rgba(233,238,245,0.9); backdrop-filter: blur(6px); }
.overlay-mandate__eyebrow { font-size: 20px; letter-spacing: 0.3em; text-transform: uppercase; color: #6b55c4; font-weight: 800; }
.overlay-mandate__lede { font-size: 24px; color: var(--ink-2); font-weight: 500; }
.overlay-mandate__row { display: flex; gap: 40px; align-items: stretch; }
.overlay-mandate__row > div { cursor: pointer; display: flex; }
.combo-tile { width: 460px; padding: 0 0 18px; border-radius: 18px; background: #fff; border: 2px solid var(--line); box-shadow: 0 10px 30px rgba(27,33,48,0.14); flex-direction: column; overflow: hidden; transition: transform 160ms ease; }
.combo-tile--on { border-color: var(--ink); outline: 4px solid var(--focus); outline-offset: 3px; transform: translateY(-6px); }
.combo-tile__head { display: flex; align-items: center; gap: 14px; padding: 16px 20px; background: var(--soft); border-bottom: 3px solid var(--c); font-size: 32px; font-weight: 800; letter-spacing: -0.01em; }
.combo-tile__cost { display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--gold); font-size: 22px; flex: none; }
.combo-tile__fam { padding: 12px 22px 0; font-size: 14px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--c); }
.combo-tile__lean { margin: 10px 22px 0; font-size: 18px; font-weight: 800; color: var(--ink); }
.combo-tile__rules { margin: 10px 22px 0; padding-left: 20px; font-size: 19px; line-height: 1.35; color: var(--ink-2); }
.combo-tile__rules li { margin-bottom: 6px; }
.overlay-mandate__hint { font-size: 20px; color: var(--ink-2); font-weight: 600; display: flex; gap: 12px; align-items: center; }
.btn-a { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; font-weight: 900; font-size: 17px; color: #000; background: #5fd36f; }

.board-wrap { position: absolute; left: 0; top: 0; z-index: -1; } /* under every panel; the stage is a stacking context (transform), so still above its background */
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

.fs-btn { position: absolute; right: 36px; bottom: 70px; z-index: 21; display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; border: 1.5px solid var(--line); background: #fff; color: var(--ink-2); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.fs-btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; }
.fs-btn__key { display: inline-grid; place-items: center; min-width: 22px; height: 22px; border-radius: 6px; background: #eef2f7; font-size: 12px; }
.fs-btn--title { z-index: 41; right: 50%; transform: translateX(50%); bottom: 300px; font-size: 20px; padding: 10px 22px; }
.build-stamp { position: absolute; right: 36px; bottom: 48px; margin: 0; font-size: 12px; color: var(--ink-3); z-index: 21; cursor: pointer; }
.pt { position: absolute; left: 36px; top: 128px; z-index: 22; display: flex; align-items: center; gap: 8px; max-width: 520px; padding: 4px 12px; font-size: 13px; border-radius: 999px; background: #fff; border: 1.5px solid var(--line); font-weight: 700; color: var(--ink-2); box-shadow: 0 4px 14px rgba(27,33,48,0.12); }
.pt__dot { width: 10px; height: 10px; border-radius: 50%; background: var(--red); flex: none; animation: pt-pulse 1.4s ease-in-out infinite; }
.pt--phone .pt__dot { background: #7a5cf0; }
.pt--paused .pt__dot, .pt--denied .pt__dot, .pt--unsupported .pt__dot { animation: none; background: #b8c0cc; }
.pt__heard { font-weight: 600; color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
@keyframes pt-pulse { 50% { opacity: 0.35; } }
.pt-qr { position: absolute; left: 36px; top: 168px; z-index: 22; display: flex; align-items: center; gap: 12px; padding: 10px 14px 10px 10px; border-radius: 14px; background: #fff; border: 2px solid #7a5cf0; box-shadow: 0 6px 20px rgba(27,33,48,0.15); font-size: 14px; font-weight: 600; color: var(--ink-2); line-height: 1.3; }
.pt-qr img { width: 112px; height: 112px; display: block; }
.pt-qr b { color: #3b2a8f; font-size: 15px; }
.pt-note { position: absolute; left: 590px; top: 150px; transform: translateX(-50%); z-index: 22; max-width: 820px; padding: 14px 22px; border-radius: 14px; background: #fff; border: 2px solid #7a5cf0; font-size: 20px; font-weight: 600; line-height: 1.35; box-shadow: 0 8px 26px rgba(27,33,48,0.18); }
.pt-note__who { display: block; font-size: 12px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #7a5cf0; margin-bottom: 4px; }
.toast { position: absolute; left: 590px; top: 92px; transform: translateX(-50%); padding: 9px 20px; border-radius: 999px; background: #fff; border: 1.5px solid var(--line); font-size: 19px; font-weight: 700; z-index: 15; white-space: nowrap; box-shadow: 0 6px 20px rgba(27,33,48,0.15); }
.toast--bad { border-color: var(--red); color: var(--red); }
.toast--good { border-color: var(--green); color: #1d7a47; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, -14px); }
.toast-enter-active, .toast-leave-active { transition: all 200ms ease; }
.offer-card { transition: transform 150ms ease; }
.offer-card--on { transform: translateY(-10px); }
.offer-skip { align-self: center; padding: 18px 28px; border-radius: 14px; background: #fff; border: 2px solid var(--line); font-size: 22px; font-weight: 800; color: var(--ink-3); cursor: pointer; }
.offer-skip--on { border-color: var(--ink); color: var(--ink); }
</style>
