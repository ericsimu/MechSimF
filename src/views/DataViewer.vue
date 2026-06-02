<template>
  <div class="result-page">
    <div class="rp-header">
      <h2>结果分析 — 任务 #{{ taskId || '—' }}</h2>
      <span v-if="taskStatus" class="dv-status" :class="'status-' + taskStatus">{{ statusLabel(taskStatus) }}</span>
    </div>

    <div v-if="!taskId" class="dv-empty">请从任务列表中选择一个任务查看数据</div>
    <div v-else class="rp-body">
      <div class="rp-right" style="flex:1;">
        <div v-if="loading" class="dv-loading">加载中...</div>
        <div v-else-if="taskStatus === 'cancelled'" class="dv-empty">该任务已被取消，无仿真数据</div>
        <div v-else-if="columns.length === 0" class="dv-empty">该任务暂无输出数据</div>
        <div v-else class="viz-body">
          <div class="viz-left">
            <div class="dv-signal-header">
              <span>信号列表 ({{ sigCols.length }})</span>
            </div>
            <div class="dv-signal-list">
              <label v-for="(c, i) in sigCols" :key="c.name" class="dv-signal-row">
                <input type="checkbox" :checked="checked[c.name] === true" @change="toggleChecked(c.name)" />
                <span class="dv-dot" :style="{ backgroundColor: COLORS[i % COLORS.length] }"></span>
                <span class="dv-signal-name">{{ c.name }}</span>
              </label>
            </div>
          </div>
          <div class="viz-right">
            <div class="dv-chart-section">
              <div class="dv-chart-title">时域图</div>
              <div ref="timeChartRef" class="dv-chart"></div>
            </div>
            <div class="dv-chart-section">
              <div class="dv-chart-title">频域图</div>
              <div ref="freqChartRef" class="dv-chart"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { getTaskDataColumns, getTaskSignals } from '../api/index'
import type { DisturbanceColumn } from '../types/api'
import uPlot from '../lib/uplot/uPlot.esm.js'
import '../lib/uplot/uPlot.min.css'
const route = useRoute()
const taskId = computed(() => Number(route.params.taskId) || 0)

const loading = ref(true)
const columns = ref<DisturbanceColumn[]>([])
const fftColumns = ref<DisturbanceColumn[]>([])
const taskStatus = ref('')
const checked = ref<Record<string, boolean>>({})

// Zoom state: saved full-range data for reset
const fullColumns = ref<DisturbanceColumn[] | null>(null)
const fullFftColumns = ref<DisturbanceColumn[] | null>(null)
const isTimeZoomed = ref(false)
const isFreqZoomed = ref(false)
// Timestamps to suppress restore briefly after chart rebuild (avoids spurious restore on init)
let timeBuildAt = 0
let freqBuildAt = 0

const timeChartRef = ref<HTMLDivElement | null>(null)
const freqChartRef = ref<HTMLDivElement | null>(null)
let timeInst: any = null
let freqInst: any = null
let timeLabels: { hook(u:any):void, clear():void } | null = null
let freqLabels: { hook(u:any):void, clear():void } | null = null
let timeDblCleanup: (() => void) | null = null
let freqDblCleanup: (() => void) | null = null

function fmtNum(v: number): string {
  if (!isFinite(v)) return String(v)
  const s = v.toFixed(10)
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s
}

function makeCursorLabels(container: HTMLElement, xUnit: string) {
  const labels: HTMLDivElement[] = []
  function removeAll() { labels.forEach(l => l.remove()); labels.length = 0 }
  container.addEventListener('mouseleave', removeAll)
  return {
    hook(u: any) {
      try {
        removeAll()
        const idx = u.cursor?.idx
        if (idx == null) return
        const xVal = u.data[0][idx]
        const xLeft = u.valToPos(xVal, 'x')
        const xl = document.createElement('div')
        xl.style.cssText = `position:absolute;left:${xLeft+4}px;bottom:22px;font-size:10px;color:#fff;background:rgba(0,0,0,0.72);padding:1px 4px;border-radius:2px;pointer-events:none;white-space:nowrap;z-index:100;`
        xl.textContent = `${fmtNum(xVal)} ${xUnit}`
        container.appendChild(xl)
        labels.push(xl)
        for (let i = 1; i < u.series.length; i++) {
          const y = u.data[i]?.[idx]
          if (y == null) continue
          const ly = u.valToPos(xVal, 'x')
          const ty = u.valToPos(y, 'y')
          const d = document.createElement('div')
          d.style.cssText = `position:absolute;left:${ly+6}px;top:${ty-14}px;font-size:10px;color:#fff;background:rgba(0,0,0,0.78);padding:1px 5px;border-radius:2px;border-left:2px solid ${u.series[i].stroke||'#888'};pointer-events:none;white-space:nowrap;z-index:100;line-height:1.5;`
          d.textContent = `${u.series[i].label||''}:${fmtNum(y)}`
          container.appendChild(d)
          labels.push(d)
        }
      } catch { /* keep cursor working */ }
    },
    clear() { removeAll() },
  }
}

const STATUS_MAP: Record<string, string> = {
  pending: '等待中', running: '运行中', done: '已完成', failed: '失败', cancelled: '已取消',
}
function statusLabel(s: string): string { return STATUS_MAP[s] || s }

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
]

const sigCols = computed(() => columns.value.filter(c => c.name.toLowerCase() !== 'time'))

// -- zoom-in detection via setSelect (fires during drag; capture range before uPlot clears it) --
function makeSelectHandler(domain: 'time' | 'fft') {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: { start: number; end: number } | null = null

  return (u: any) => {
    const buildAt = domain === 'time' ? timeBuildAt : freqBuildAt
    if (Date.now() - buildAt < 500) return
    // Capture select rect synchronously — uPlot clears it right after mouseup
    if (u.select && u.select.width > 5) {
      const xMin = u.posToVal(u.select.left, 'x')
      const xMax = u.posToVal(u.select.left + u.select.width, 'x')
      pending = { start: Math.min(xMin, xMax), end: Math.max(xMin, xMax) }
    }
    if (timer) clearTimeout(timer)
    timer = setTimeout(async () => {
      if (!pending) return
      const rng = pending; pending = null
      const zoomed = domain === 'time' ? isTimeZoomed.value : isFreqZoomed.value
      const target = domain === 'fft' ? fftColumns : columns
      // Only save original full data on first zoom; allow re-zoom for deeper drill-in
      if (!zoomed) {
        if (domain === 'time') fullColumns.value = target.value.map(c => ({ name: c.name, data: [...c.data] }))
        else fullFftColumns.value = target.value.map(c => ({ name: c.name, data: [...c.data] }))
      }

      const sigs: string[] = u.series.slice(1).map((s: any) => s.label).filter(Boolean)
      if (sigs.length === 0) return
      const xName = domain === 'fft' ? 'frequency' : 'time'

      try {
        const zoomRange = rng.end - rng.start
        const raw = domain === 'fft' || zoomRange < 1.0
        const r = await getTaskSignals(taskId.value, [xName, ...sigs], domain, rng.start, rng.end, raw)
        if (r.success && r.data) {
          // Merge zoomed data into existing columns — keep the full signal list
          for (const sc of r.data.columns) {
            const col = target.value.find(c => c.name === sc.name)
            if (col) {
              col.data = sc.data
            }
          }
          if (domain === 'time') {
            columns.value = [...columns.value]
            isTimeZoomed.value = true
            timeBuildAt = Date.now()
          } else {
            fftColumns.value = [...fftColumns.value]
            isFreqZoomed.value = true
            freqBuildAt = Date.now()
          }
        }
      } catch { /* */ }
    }, 200)
  }
}

// -- zoom-out via native dblclick (more reliable than intercepting uPlot setScale) --
function restoreZoom(domain: 'time' | 'fft') {
  const zoomed = domain === 'time' ? isTimeZoomed.value : isFreqZoomed.value
  const full = domain === 'time' ? fullColumns.value : fullFftColumns.value
  if (!zoomed || !full) return

  if (domain === 'time') {
    fullColumns.value = null
    isTimeZoomed.value = false
    timeBuildAt = Date.now()
    const checkedNames = Object.keys(checked.value).filter(k => checked.value[k])
    if (checkedNames.length > 0) {
      for (const name of checkedNames) {
        const col = columns.value.find(c => c.name === name)
        if (col) col.data = []
      }
      const timeCol = columns.value.find(c => c.name.toLowerCase() === 'time')
      if (timeCol) timeCol.data = []
      columns.value = [...columns.value]
      fetchSignals(checkedNames, 'time')
    }
  } else {
    fullFftColumns.value = null
    isFreqZoomed.value = false
    freqBuildAt = Date.now()
    const checkedNames = Object.keys(checked.value).filter(k => checked.value[k])
    if (checkedNames.length > 0) {
      for (const name of checkedNames) {
        const col = fftColumns.value.find(c => c.name === name)
        if (col) col.data = []
      }
      const freqCol = fftColumns.value.find(c => c.name.toLowerCase() === 'frequency')
      if (freqCol) freqCol.data = []
      fftColumns.value = [...fftColumns.value]
      fetchSignals(checkedNames, 'fft')
    }
  }
}

function buildTimeChart(): void {
  if (timeDblCleanup) { timeDblCleanup(); timeDblCleanup = null }
  if (timeInst) { timeInst.destroy(); timeInst = null }
  if (timeLabels) { timeLabels.clear(); timeLabels = null }
  const el = timeChartRef.value
  if (!el || columns.value.length === 0) return

  const timeCol = columns.value.find(c => c.name.toLowerCase() === 'time')
  const activeSigs = sigCols.value.filter(c => checked.value[c.name] === true && c.data.length > 0)
  if (activeSigs.length === 0) return

  const timeLen = timeCol && timeCol.data.length > 0 ? timeCol.data.length : activeSigs[0].data.length
  const timeDataArr = timeCol && timeCol.data.length > 0 ? timeCol.data.map(v => v ?? 0) : activeSigs[0].data.map((_, i) => i)
  const w = el.offsetWidth || 800
  timeLabels = makeCursorLabels(el, 's')

  const series: Array<object> = [{}]
  const signalArrays: Array<Array<number | null>> = []
  for (const c of activeSigs) {
    const ci = sigCols.value.findIndex(sc => sc.name === c.name)
    series.push({
      label: c.name, stroke: COLORS[ci >= 0 ? ci % COLORS.length : 0], width: 1.5,
    })
    const mapped = c.data.map(v => v == null ? null : Number(v))
    if (mapped.length !== timeLen) {
      signalArrays.push(mapped.slice(0, timeLen))
    } else {
      signalArrays.push(mapped)
    }
  }
  const data = [timeDataArr, ...signalArrays]

  try {
    timeBuildAt = Date.now()
    timeInst = new (uPlot as any)({
      width: w, height: 300,
      cursor: { show: true, drag: { setScale: true, x: true, y: false } },
      legend: { show: false },
      scales: { x: { time: false } },
      axes: [
        { label: timeCol ? 'Time (s)' : 'Index', grid: { stroke: '#e8e8e8' }, stroke: '#888',
          values: (self: any, ticks: number[]) => ticks.map(t => t.toFixed(2) + ' s') },
        { stroke: '#888', grid: { stroke: '#e8e8e8' } },
      ],
      series,
      hooks: {
        setCursor: [timeLabels.hook],
        setSelect: [makeSelectHandler('time')],
      },
    }, data, el)
    // Use uPlot's internal .u-over canvas for dblclick — the container
    // div may not receive the event reliably through uPlot's canvases.
    const dblHandler = () => restoreZoom('time')
    const overEl = el.querySelector('.u-over') as HTMLElement | null
    if (overEl) {
      overEl.addEventListener('dblclick', dblHandler)
      timeDblCleanup = () => overEl.removeEventListener('dblclick', dblHandler)
    } else {
      el.addEventListener('dblclick', dblHandler)
      timeDblCleanup = () => el.removeEventListener('dblclick', dblHandler)
    }
  } catch (e) {
    console.error('buildTimeChart failed:', e)
    timeInst = null
  }
}

function buildFreqChart(): void {
  if (freqDblCleanup) { freqDblCleanup(); freqDblCleanup = null }
  if (freqInst) { freqInst.destroy(); freqInst = null }
  if (freqLabels) { freqLabels.clear(); freqLabels = null }
  const el = freqChartRef.value
  if (!el || fftColumns.value.length === 0) return

  const freqCol = fftColumns.value.find(c => c.name.toLowerCase() === 'frequency')
  const activeSigs = fftColumns.value.filter(c => c.name.toLowerCase() !== 'frequency' && checked.value[c.name] === true && c.data.length > 0)
  if (activeSigs.length === 0 || !freqCol || freqCol.data.length === 0) return

  const w = el.offsetWidth || 800
  freqLabels = makeCursorLabels(el, '')

  const series: Array<object> = [{}]
  activeSigs.forEach((c) => {
    const ci = sigCols.value.findIndex(sc => sc.name === c.name)
    series.push({
      label: c.name, stroke: COLORS[ci >= 0 ? ci % COLORS.length : 0], width: 1.5,
    })
  })
  const data = [freqCol.data.map(v => v ?? 0), ...activeSigs.map(c => c.data.map(v => v == null ? null : Number(v)))]

  freqBuildAt = Date.now()
  freqInst = new (uPlot as any)({
    width: w, height: 300,
    cursor: { show: true, drag: { setScale: true, x: true, y: false } },
    legend: { show: false },
    scales: { x: { time: false } },
    axes: [
      { label: 'Frequency (log10 Hz)', grid: { stroke: '#e8e8e8' }, stroke: '#888' },
      { stroke: '#888', grid: { stroke: '#e8e8e8' } },
    ],
    series,
    hooks: {
      setCursor: [freqLabels.hook],
      setSelect: [makeSelectHandler('fft')],
    },
  }, data, el)
  const dblHandler = () => restoreZoom('fft')
  const overEl = el.querySelector('.u-over') as HTMLElement | null
  if (overEl) {
    overEl.addEventListener('dblclick', dblHandler)
    freqDblCleanup = () => overEl.removeEventListener('dblclick', dblHandler)
  } else {
    el.addEventListener('dblclick', dblHandler)
    freqDblCleanup = () => el.removeEventListener('dblclick', dblHandler)
  }
}

async function fetchSignals(names: string[], domain: 'time' | 'fft', start?: number, end?: number): Promise<void> {
  const target = domain === 'fft' ? fftColumns : columns
  let hasRange = start != null && end != null

  // When zoomed in time domain and no explicit range, auto-use current zoom window
  if (!hasRange && domain === 'time' && isTimeZoomed.value) {
    const timeCol = target.value.find(c => c.name.toLowerCase() === 'time')
    if (timeCol && timeCol.data.length > 0) {
      const d = timeCol.data
      start = d[0] ?? undefined
      end = d[d.length - 1] ?? undefined
      hasRange = start != null && end != null
    }
  }

  let toFetch: string[]
  if (hasRange) {
    toFetch = [...names]
  } else {
    toFetch = names.filter(n => {
      const col = target.value.find(c => c.name === n)
      return col && col.data.length === 0
    })
    if (toFetch.length === 0) return
  }

  const xName = domain === 'fft' ? 'frequency' : 'time'
  const xCol = target.value.find(c => c.name.toLowerCase() === xName)
  if (xCol && xCol.data.length === 0 && !toFetch.includes(xCol.name)) {
    toFetch.push(xCol.name)
  }

  // Downsample full-range data for speed; use raw for zoomed sub-second views
  const raw = domain === 'fft' || (hasRange && (end! - start!) < 1.0)

  try {
    const r = await getTaskSignals(taskId.value, toFetch, domain, start, end, raw)
    if (r.success && r.data) {
      for (const sc of r.data.columns) {
        // Never replace the x-axis column with data from an unrequested signal.
        // Each signal CSV has its own time base; overwriting the shared time
        // column would misalign other signals already in columns.
        if (sc.name.toLowerCase() === xName && !toFetch.some(n => n.toLowerCase() === xName)) continue
        const col = target.value.find(c => c.name === sc.name)
        if (col) col.data = sc.data
      }
      target.value = [...target.value]
    }
  } catch { /* */ }
}

function toggleChecked(name: string): void {
  checked.value = { ...checked.value, [name]: !checked.value[name] }
  if (checked.value[name]) {
    fetchSignals([name], 'time')
    fetchSignals([name], 'fft')
  }
}


onMounted(async () => {
  const tid = taskId.value
  if (!tid) { loading.value = false; return }
  try {
    const r = await getTaskDataColumns(tid)
    if (r.success && r.data) {
      columns.value = [
        { name: 'time', data: [] as (number | null)[] },
        ...r.data.column_names.map((n: string) => ({ name: n, data: [] as (number | null)[] })),
      ]
      fftColumns.value = [
        { name: 'frequency', data: [] as (number | null)[] },
        ...(r.data.fft_column_names || []).map((n: string) => ({ name: n, data: [] as (number | null)[] })),
      ]
      taskStatus.value = r.data.task_status
      checked.value = {}
    }
  } catch { /* */ }
  finally { loading.value = false }
})

watch([columns, fftColumns, checked], () => {
  if (loading.value || columns.value.length === 0) return
  nextTick(() => {
    buildTimeChart()
    buildFreqChart()
  })
})

let resizeTimer: ReturnType<typeof setTimeout> | null = null
function onResize(): void {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => { buildTimeChart(); buildFreqChart() }, 200)
}

onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  if (timeDblCleanup) { timeDblCleanup(); timeDblCleanup = null }
  if (freqDblCleanup) { freqDblCleanup(); freqDblCleanup = null }
  if (timeInst) timeInst.destroy()
  if (freqInst) freqInst.destroy()
  if (timeLabels) { timeLabels.clear(); timeLabels = null }
  if (freqLabels) { freqLabels.clear(); freqLabels = null }
})
</script>

<style scoped>
.result-page { height: calc(100vh - 60px); display: flex; flex-direction: column; padding: 16px; }
.rp-header { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
.rp-header h2 { font-size: 16px; font-weight: 600; margin: 0; }
.dv-status { font-size: 12px; padding: 2px 10px; border-radius: 10px; font-weight: 500; }
.dv-status.status-done { background: #d1fae5; color: #065f46; }
.dv-status.status-running { background: #dbeafe; color: #1e40af; }
.dv-status.status-pending { background: #fef3c7; color: #92400e; }
.dv-status.status-failed { background: #fee2e2; color: #991b1b; }
.dv-status.status-cancelled { background: #f3f4f6; color: #6b7280; }

.dv-empty { text-align: center; color: var(--text-secondary); padding: 120px 0; font-size: 14px; }
.dv-loading { text-align: center; padding: 40px 0; color: var(--text-secondary); }

.rp-body { display: flex; flex: 1; gap: 12px; overflow: hidden; }
.rp-right { flex: 1; overflow-y: auto; }

/* 数据可视化 */
.viz-body { display: flex; gap: 12px; height: 100%; }
.viz-left {
  width: 220px; flex-shrink: 0; border: 1px solid var(--border); border-radius: 6px;
  display: flex; flex-direction: column; overflow: hidden; background: var(--panel-bg);
}
.viz-right { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.dv-signal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px; border-bottom: 1px solid var(--border); font-weight: 600; font-size: 13px;
}
.dv-signal-actions { display: flex; flex-direction: row; align-items: center; gap: 6px; flex-shrink: 0; }
.dv-signal-actions .aurora-btn { white-space: nowrap; flex-shrink: 0; }
.dv-signal-list { flex: 1; overflow-y: auto; padding: 6px 10px; display: flex; flex-direction: column; gap: 2px; }
.dv-signal-row { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; padding: 2px 0; }
.dv-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.dv-signal-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.dv-chart-section { display: flex; flex-direction: column; }
.dv-chart-title { font-size: 13px; font-weight: 600; color: #555; margin-bottom: 2px; }
.dv-chart { min-height: 300px; min-width: 100%; position: relative; }
</style>
