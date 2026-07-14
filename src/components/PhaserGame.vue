<template>
  <div ref="gameContainer" class="phaser-game"></div>
</template>

<script>
import Phaser from 'phaser'
import { createGameConfig } from '@/game/config'

export default {
  name: 'PhaserGame',
  data () {
    return {
      game: null
    }
  },
  mounted () {
    this.game = new Phaser.Game(createGameConfig(this.$refs.gameContainer))
  },
  beforeUnmount () {
    this.game?.destroy(true)
  }
}
</script>

<style scoped>
.phaser-game {
  width: 100%;
  height: 100%;
}
</style>
