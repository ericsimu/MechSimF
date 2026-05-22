<template>
  <div class="case-list">
    <div class="page-header">
      <h2>任务列表</h2>
    </div>
    <table v-if="!loading">
      <thead>
        <tr><th>ID</th><th>名称</th><th>系统</th><th>版本</th><th>产率</th><th>状态</th><th>创建时间</th></tr>
      </thead>
      <tbody>
        <tr v-if="tasks.length === 0"><td colspan="7" class="empty">暂无数据</td></tr>
        <tr v-for="t in tasks" :key="t.id">
          <td>{{ t.id }}</td>
          <td>{{ t.name }}</td>
          <td>{{ t.sys_name || '-' }}</td>
          <td>{{ t.model_version || '-' }}</td>
          <td>{{ t.model_productivity || '-' }}</td>
          <td><span class="status-tag" :class="'status-' + t.status">{{ statusLabel(t.status) }}</span></td>
          <td>{{ t.create_time ? new Date(t.create_time).toLocaleString() : '-' }}</td>
        </tr>
      </tbody>
    </table>
    <div v-else class="loading">加载中...</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { SimTask } from '../types/api'
import { queueTasks } from '../api/index'

const tasks = ref<SimTask[]>([])
const loading = ref(true)
let timer: ReturnType<typeof setInterval> | null = null

const STATUS_MAP: Record<string, string> = {
  pending: '等待中',
  running: '运行中',
  done: '已完成',
  failed: '失败',
  cancelled: '已取消',
}

const ACTIVE_STATES = new Set(['pending', 'running'])

function statusLabel(s: string): string { return STATUS_MAP[s] || s }

async function loadTasks(): Promise<void> {
  try { const r = await queueTasks(); if (r.success && r.data) tasks.value = r.data }
  catch { /* ignore poll errors */ }
}

function startPolling(): void {
  if (timer) return
  timer = setInterval(async () => {
    await loadTasks()
    if (!tasks.value.some(t => ACTIVE_STATES.has(t.status))) {
      clearInterval(timer!)
      timer = null
    }
  }, 3000)
}

onMounted(async () => {
  try { const r = await queueTasks(); if (r.success && r.data) tasks.value = r.data }
  catch { console.error('加载任务失败:') }
  finally { loading.value = false }
  if (tasks.value.some(t => ACTIVE_STATES.has(t.status))) startPolling()
})

onUnmounted(() => { if (timer) { clearInterval(timer); timer = null } })
</script>

<style scoped>
.page-header { display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid var(--border); }
.page-header h2 { font-size:16px; font-weight:600; }
.case-list { background:var(--panel-bg); border-radius:var(--radius); box-shadow:0 1px 3px rgba(0,0,0,0.08); }
.case-list th:first-child, .case-list td:first-child { padding-left:24px; }
.case-list th:last-child, .case-list td:last-child { padding-right:24px; }
.empty { text-align:center; color:var(--text-secondary); padding:60px 0; }
.loading { text-align:center; padding:80px 0; color:var(--text-secondary); }
.status-tag { font-size:12px; padding:2px 8px; border-radius:10px; font-weight:500; }
.status-pending { background:#fef3c7; color:#92400e; }
.status-running { background:#dbeafe; color:#1e40af; }
.status-done { background:#d1fae5; color:#065f46; }
.status-failed { background:#fee2e2; color:#991b1b; }
.status-cancelled { background:#f3f4f6; color:#6b7280; }
</style>
