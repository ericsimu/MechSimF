<template>
  <div class="placeholder">
    {{ title }} - 开发中
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()
const title = computed(() => {
  const map = { '/tasks': '任务管理', '/data': '数据查看' }
  return map[route.path] || ''
})
</script>

<style scoped>
.placeholder { text-align:center; color:#999; padding:120px 0; font-size:15px; }
</style>
