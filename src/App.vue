<template>
  <div id="app">
    <div class="game-area">
      <PhaserGame ref="phaserGame" @cell-click="onCellClick" @ready="refresh" />
      <Hud :game="game" :render-tick="renderTick" @advance="advance" @acquire="acquire" />
    </div>
    <HandBar :game="game" :armed-index="armedIndex" :render-tick="renderTick" @arm="armCard" />
  </div>
</template>

<script>
import PhaserGame from '@/components/PhaserGame.vue'
import Hud from '@/components/Hud.vue'
import HandBar from '@/components/HandBar.vue'
import { createGame, exampleCards } from '@/game/core'

export default {
  name: 'App',
  components: { PhaserGame, Hud, HandBar },
  data () {
    return {
      game: null,
      armedIndex: null,
      renderTick: 0
    }
  },
  created () {
    // Wires up a demo game from the illustrative example cards — not real
    // starter content. See src/game/core/cards/exampleCards.js.
    this.game = createGame({
      cardCatalog: exampleCards.EXAMPLE_CARDS,
      startingDeckCardIds: ['road', 'road', 'residential', 'residential', 'road'],
      cityDeckCardIds: ['clinic'],
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
      this.$refs.phaserGame.setPlacementMode(false)
      this.refresh()
    },
    // Tracked by hand position, not card id — multiple cards in hand can
    // share the same id (e.g. two Roads), and armedCardId used to arm all
    // of them at once instead of just the one that was clicked.
    armCard (index) {
      this.armedIndex = this.armedIndex === index ? null : index
      this.$refs.phaserGame.setPlacementMode(this.armedIndex !== null)
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
