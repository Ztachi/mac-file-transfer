<template>
  <div class="app">
    <explorer-view />
  </div>
</template>

<script setup>
import ExplorerView from './views/ExplorerView.vue';
</script>

<style lang="scss">
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.app {
  width: 100%;
  height: 100vh;
}

* {
  box-sizing: border-box;
}
</style> 