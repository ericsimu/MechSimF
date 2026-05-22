<template>
  <div class="placeholder">
    {{ title }} - 开发中
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()
const title = computed<string>(() => {
  const map: Record<string, string> = { '/tasks': '任务管理', '/data': '数据查看' }
  return map[route.path] || ''
})
</script>

<style scoped>
.placeholder { text-align:center; color:#999; padding:120px 0; font-size:15px; }
</style>
