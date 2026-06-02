<template>
  <div class="case-list">
    <div class="page-header">
      <h2>任务列表</h2>
    </div>
    <table v-if="!loading">
      <thead>
        <tr><th>ID</th><th>名称</th><th>系统</th><th>模型</th><th>版本</th><th>产率</th><th>状态</th><th>参数变更</th><th>创建时间</th><th>操作</th></tr>
      </thead>
      <tbody>
        <tr v-if="tasks.length === 0"><td colspan="10" class="empty">暂无数据</td></tr>
        <tr v-for="t in tasks" :key="t.id">
          <td>{{ t.id }}</td>
          <td>{{ t.name }}</td>
          <td>{{ t.sys_name || '-' }}</td>
          <td>{{ t.model_name || '-' }}</td>
          <td>{{ t.model_version || '-' }}</td>
          <td>{{ t.model_productivity || '-' }}</td>
          <td><span class="status-tag" :class="'status-' + t.status">{{ statusLabel(t.status) }}</span></td>
          <td><span v-if="t.param_diff" class="task-id-link" @click="showDiff(t)">查看</span><span v-else>-</span></td>
          <td>{{ t.create_time ? new Date(t.create_time).toLocaleString() : '-' }}</td>
          <td>
            <button class="aurora-btn aurora-btn--text" style="color:var(--accent);" @click="$router.push('/data/' + t.id)">详情</button>
            <button v-if="t.status === 'pending' || t.status === 'running'" class="aurora-btn aurora-btn--text" style="color:var(--accent);" @click="handleCancel(t)">取消</button>
            <button class="aurora-btn aurora-btn--text" style="color:var(--accent);" @click="confirmDelete(t)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="loading">加载中...</div>

    <!-- Diff Modal -->
    <div v-if="diffOpen" class="modal-overlay" @click.self="diffOpen = false">
      <div class="modal-panel" style="width:700px;">
        <div class="modal-title">参数变更详情</div>
        <table v-if="diffRows.length > 0" class="diff-table">
          <thead><tr><th>参数路径</th><th>原值</th><th>新值</th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in diffRows" :key="i">
              <td>{{ r.path }}</td>
              <td>{{ r.old }}</td>
              <td>{{ r.new }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="diff-empty">无变更</div>
        <div class="modal-footer">
          <button class="aurora-btn" @click="diffOpen = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal-panel" style="width:400px;">
        <div class="modal-title">确认删除</div>
        <p>确定要删除任务 #{{ deleteTarget.id }}「{{ deleteTarget.name }}」吗？</p>
        <div class="modal-footer">
          <button class="aurora-btn" @click="deleteTarget = null">取消</button>
          <button class="aurora-btn aurora-btn--primary" style="background:#ef4444;" :disabled="deleting" @click="handleDelete">{{ deleting ? '...' : '确认' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { SimTask } from '../types/api'
import { queueTasks, deleteTask, cancelTask } from '../api/index'

interface DiffRow { path: string; old: string; new: string }

const tasks = ref<SimTask[]>([])
const loading = ref(true)
const diffOpen = ref(false)
const diffRows = ref<DiffRow[]>([])
const deleteTarget = ref<SimTask | null>(null)
const deleting = ref(false)
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

function confirmDelete(task: SimTask): void {
  deleteTarget.value = task
}

async function handleDelete(): Promise<void> {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    const r = await deleteTask(deleteTarget.value.id!)
    if (r.success) { deleteTarget.value = null; loadTasks() }
  } catch { /* */ }
  finally { deleting.value = false }
}

async function handleCancel(task: SimTask): Promise<void> {
  if (!confirm(`确定要取消任务 #${task.id}「${task.name}」吗？这将强制终止 MATLAB 进程。`)) return
  try {
    const r = await cancelTask(task.id!)
    if (r.success) { loadTasks() }
  } catch { /* */ }
}

function showDiff(task: SimTask): void {
  if (!task.param_diff) return
  try {
    const parsed = JSON.parse(task.param_diff)
    const rows: DiffRow[] = []
    const fmt = (v: unknown) => v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    const cleanPath = (raw: string) => raw.replace(/^root/, '').replace(/\['([^']*)'\]/g, '.$1').replace(/\["([^"]*)"\]/g, '.$1').replace(/^\./, '')
    for (const [changeType, items] of Object.entries(parsed)) {
      if (!items || typeof items !== 'object') continue
      const prefix = changeType.includes('added') ? '+ ' : changeType.includes('removed') ? '- ' : ''
      for (const [path, v] of Object.entries(items as Record<string, any>)) {
        rows.push({ path: prefix + cleanPath(path), old: fmt(v.old_value), new: fmt(v.new_value) })
      }
    }
    diffRows.value = rows
    diffOpen.value = true
  } catch { /* */ }
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
.task-id-link { color: #3b82f6; cursor: pointer; font-weight: 500; text-decoration: none; }
.task-id-link:hover { text-decoration: underline; }

/* Modal */
.modal-overlay { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; z-index:1000; }
.modal-panel { background:var(--panel-bg); border-radius:var(--radius); padding:20px 24px; max-height:80vh; overflow-y:auto; box-shadow:0 4px 20px rgba(0,0,0,0.15); }
.modal-title { font-size:15px; font-weight:600; margin-bottom:16px; }
.modal-footer { margin-top:16px; display:flex; justify-content:flex-end; }
.diff-table { width:100%; border-collapse:collapse; font-size:13px; }
.diff-table th { text-align:left; padding:8px 12px; background:#f5f5f5; border-bottom:1px solid var(--border); }
.diff-table td { padding:6px 12px; border-bottom:1px solid var(--border); word-break:break-all; }
.diff-empty { text-align:center; color:var(--text-secondary); padding:40px 0; }
</style>
