<template>
  <div ref="gameContainer" class="phaser-game"></div>
</template>

<script>
import Phaser from 'phaser'
import { createGameConfig } from '@/game/config'

export default {
  name: 'PhaserGame',
  emits: ['cell-click', 'ready'],
  data () {
    return {
      game: null,
      mainScene: null
    }
  },
  mounted () {
    this.game = new Phaser.Game(createGameConfig(this.$refs.gameContainer))
    this.game.events.once('mainSceneReady', (scene) => {
      this.mainScene = scene
      this.mainScene.events.on('cellClick', (cell) => this.$emit('cell-click', cell))
      this.$emit('ready')
    })
  },
  beforeUnmount () {
    this.game?.destroy(true)
  },
  methods: {
    renderCity (cityGrid, builtStructures) {
      this.mainScene?.renderCity(cityGrid, builtStructures)
    },
    setPlacementMode (active) {
      this.mainScene?.setPlacementMode(active)
    }
  }
}
</script>

<style scoped>
.phaser-game {
  flex: 1;
  min-width: 0;
  height: 100%;
}
</style>
