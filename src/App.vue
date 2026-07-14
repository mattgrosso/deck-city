<template>
  <div id="app">
    <div class="game-area">
      <PhaserGame ref="phaserGame" @cell-click="onCellClick" @ready="refresh" />
      <Hud :game="game" :render-tick="renderTick" @advance="advance" @acquire="acquire" />
    </div>
    <HandBar
      :game="game"
      :armed-index="armedIndex"
      :civic-selection="civicSelection"
      :render-tick="renderTick"
      @arm="armCard"
      @toggle-discard="toggleDiscardSelection"
      @cancel-civic="cancelCivicSelection"
    />
  </div>
</template>

<script>
import PhaserGame from '@/components/PhaserGame.vue'
import Hud from '@/components/Hud.vue'
import HandBar from '@/components/HandBar.vue'
import { createGame, starterCards } from '@/game/core'

export default {
  name: 'App',
  components: { PhaserGame, Hud, HandBar },
  data () {
    return {
      game: null,
      armedIndex: null,
      // { cardIndex, discardIndices } while a civic card's discard
      // selection is in progress, otherwise null.
      civicSelection: null,
      renderTick: 0
    }
  },
  created () {
    // Wires up the real 10-card starter deck. See
    // src/game/core/cards/starterCards.js.
    this.game = createGame({
      cardCatalog: starterCards.STARTER_CARD_CATALOG,
      startingDeckCardIds: starterCards.STARTER_DECK_CARDS,
      treasury: 10
    })
  },
  methods: {
    // The engine mutates its own plain-object state directly rather than
    // through Vue's reactivity, so nothing tells Vue to re-render Hud/
    // HandBar just because App re-renders (they'd be skipped: the `game`
    // prop reference never changes). Bumping this real reactive counter,
    // passed down as a prop, is what actually triggers their re-render;
    // they then read fresh values off `game` via plain methods.
    refresh () {
      this.renderTick++
      this.$refs.phaserGame.renderCity(this.game.state.cityGrid, this.game.state.builtStructures)
    },
    advance () {
      this.game.actions.advance()
      this.armedIndex = null
      this.civicSelection = null
      this.$refs.phaserGame.setPlacementMode(false)
      this.refresh()
    },
    // Tracked by hand position, not card id — multiple cards in hand can
    // share the same id (e.g. two Roads), and id-based tracking would arm
    // all of them at once instead of just the one that was clicked.
    armCard (index) {
      const card = this.game.state.hand[index]
      if (!card) return

      // Civic cards don't target the grid — clicking one starts a "pick 2
      // cards to discard" selection instead of arming for placement.
      if (card.type === 'civic') {
        this.civicSelection = { cardIndex: index, discardIndices: [] }
        return
      }

      this.armedIndex = this.armedIndex === index ? null : index
      this.$refs.phaserGame.setPlacementMode(this.armedIndex !== null, {
        // Road cards create frontage rather than needing it, so any empty
        // cell is a valid target; everything else requires road access.
        requiresRoadAccess: !card.placesRoad
      })
    },
    cancelCivicSelection () {
      this.civicSelection = null
    },
    toggleDiscardSelection (index) {
      if (!this.civicSelection) return
      const { discardIndices } = this.civicSelection
      const existingPos = discardIndices.indexOf(index)

      if (existingPos !== -1) {
        discardIndices.splice(existingPos, 1)
        return
      }
      if (discardIndices.length >= 2) return
      discardIndices.push(index)

      if (discardIndices.length === 2) {
        const civicCard = this.game.state.hand[this.civicSelection.cardIndex]
        const discardCardIds = discardIndices.map(i => this.game.state.hand[i].id)
        try {
          this.game.actions.playCivicCard(civicCard.id, discardCardIds)
        } catch (err) {
          console.error(err)
        }
        this.civicSelection = null
        this.refresh()
      }
    },
    onCellClick ({ x, y }) {
      if (this.armedIndex === null) return
      const card = this.game.state.hand[this.armedIndex]
      if (card) {
        try {
          this.game.actions.playCard(card.id, { x, y })
        } catch (err) {
          console.error(err)
        }
      }
      this.armedIndex = null
      this.$refs.phaserGame.setPlacementMode(false)
      this.refresh()
    },
    acquire (cardId) {
      this.game.actions.acquireCard(cardId)
      this.refresh()
    }
  }
}
</script>

<style scoped>
#app {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.game-area {
  flex: 1;
  min-height: 0;
  display: flex;
}
</style>
