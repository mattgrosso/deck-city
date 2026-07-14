<template>
  <div id="app">
    <PhaserGame />
  </div>
</template>

<script>
import PhaserGame from '@/components/PhaserGame.vue'

export default {
  name: 'App',
  components: { PhaserGame }
}
</script>

<style scoped>
#app {
  width: 100vw;
  height: 100vh;
  display: flex;
}
</style>
