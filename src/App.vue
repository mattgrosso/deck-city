<template>
  <div id="app">
    <PhaserGame />
    <Hud />
  </div>
</template>

<script>
import PhaserGame from '@/components/PhaserGame.vue'
import Hud from '@/components/Hud.vue'

export default {
  name: 'App',
  components: { PhaserGame, Hud }
}
</script>

<style scoped>
#app {
  width: 100vw;
  height: 100vh;
  display: flex;
}
</style>
