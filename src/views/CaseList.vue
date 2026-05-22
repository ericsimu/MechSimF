<template>
  <div class="case-page">
    <div class="split-container">
      <!-- Case list (always visible, fills space when no edit panel) -->
      <div class="case-list" :style="editCase ? { height: (splitRatio * 100) + '%', overflow: 'auto' } : {}">
        <div class="page-header">
          <h2>用例列表</h2>
          <AuroraButton class="btn-outline" @click="modalOpen = true">创建用例</AuroraButton>
        </div>
        <table v-if="!loading">
          <thead>
            <tr><th>名称</th><th>描述</th><th>创建者</th><th>创建时间</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-if="cases.length === 0"><td colspan="5" class="empty">暂无数据</td></tr>
            <tr v-for="c in cases" :key="c.id" :class="{ 'row-selected': editCase?.id === c.id }">
              <td>
                <input v-if="editing.id===c.id && editing.field==='name'" v-model="editValue" class="inline-input"
                  @blur="saveInline(c,'name')" @keydown.enter="saveInline(c,'name')" @keydown.escape="cancelInline" />
                <span v-else class="editable-cell" @click="startInline(c,'name')">{{ c.name || '-' }}</span>
              </td>
              <td>
                <input v-if="editing.id===c.id && editing.field==='description'" v-model="editValue" class="inline-input"
                  @blur="saveInline(c,'description')" @keydown.enter="saveInline(c,'description')" @keydown.escape="cancelInline" />
                <span v-else class="editable-cell" @click="startInline(c,'description')">{{ c.description || '-' }}</span>
              </td>
              <td>{{ c.create_by }}</td>
              <td>{{ c.create_time ? new Date(c.create_time).toLocaleString() : '-' }}</td>
              <td><div class="actions-cell">
                <AuroraButton class="btn-outline" size="mini" @click="openEdit(c)">编辑</AuroraButton>
                <AuroraButton class="btn-outline" size="mini" @click="handleCopy(c)">复制</AuroraButton>
                <AuroraButton class="btn-outline" size="mini" @click="openShare(c)">共享</AuroraButton>
                <AuroraButton class="btn-outline" size="mini" @click="confirmDelete(c)">删除</AuroraButton>
              </div></td>
            </tr>
          </tbody>
        </table>
        <div v-else class="loading">加载中...</div>
      </div>

      <template v-if="editCase">
        <div class="resize-handle" @mousedown="startResize" :class="{ dragging: isResizing }"></div>

        <div class="edit-panel">
          <div class="edit-toolbar">
            <h3>{{ editCase.name }}</h3>
            <div class="toolbar-actions">
              <AuroraButton class="btn-outline" size="small" @click="openTaskModal">创建任务</AuroraButton>
              <AuroraButton class="btn-outline" size="small" :load="saving" @click="handleSave">保存</AuroraButton>
            </div>
          </div>

          <div class="edit-body">
            <div class="edit-left" :style="{ width: leftPanelWidth + 'px' }">
              <div class="tree-section" :class="{ 'section-active': activeSection==='model' }">
                <div class="tree-section-header" @click="activateSection('model')">
                  <span class="tree-section-title">模型选择</span>
                </div>
              </div>
              <TreeSection title="参数配置" :expanded="trees.param" @toggle="toggleTree('param')">
                <div v-if="trees.param" class="tree tree-content">
                  <TreeNode v-for="[k,v] in paramEntries" :key="k" :name="k" :value="v" :path="k"
                    :selPath="selParamPath" :expanded="paramExpanded"
                    @toggle="p => paramExpanded[p] = !paramExpanded[p]"
                    @select="onParamSelect" />
                  <div v-if="paramEntries.length===0" style="color:#999;font-size:12px;padding:8px">暂无参数数据</div>
                </div>
              </TreeSection>
              <TreeSection title="扰动分析" :expanded="trees.disturb" @toggle="toggleTree('disturb')">
                <div v-if="trees.disturb" class="tree tree-content">
                  <DistTreeNode v-for="[k,v] in disturbEntries" :key="k" :name="k" :value="v" :path="k"
                    :checked="disturbChecked" :expanded="disturbExpanded" :selFile="selDisturbFile"
                    @toggle="p => disturbExpanded[p] = !disturbExpanded[p]"
                    @check="onDisturbCheck" @leafClick="onDisturbLeafClick" />
                  <template v-if="disturbTree.files?.length > 0">
                    <div v-for="f in disturbTree.files" :key="f.path" class="tree-node">
                      <label>
                        <span class="tree-toggle" style="visibility:hidden">▶</span>
                        <input type="checkbox" :checked="!!disturbChecked[f.path]" @change="onDisturbCheck(f.path)" />
                        <span :style="{cursor:'pointer',color:selDisturbFile===f.path?'var(--accent)':undefined}" @click="onDisturbLeafClick(f.path)">{{ f.name }}</span>
                      </label>
                    </div>
                  </template>
                </div>
              </TreeSection>
              <TreeSection title="指标分析" :expanded="trees.indicator" @toggle="toggleTree('indicator')">
                <div v-if="trees.indicator" class="tree-content" style="color:#999;font-size:13px;padding:12px">此页面暂未填充内容</div>
              </TreeSection>
            </div>

            <div class="h-resize-handle" @mousedown="startResizeLeft" :class="{ dragging: isResizingLeft }"></div>

            <div class="edit-right">
              <template v-if="activeSection==='model'">
                <div class="model-select-panel">
                  <div class="select-group">
                    <label class="select-label">系统选择</label>
                    <select v-model="editDraft.sys_name" @change="onSystemChange(editDraft.sys_name)">
                      <option value="" disabled>请选择系统</option>
                      <option v-for="s in systems" :key="s" :value="s">{{ s }}</option>
                    </select>
                  </div>
                  <div class="select-group">
                    <label class="select-label">产率</label>
                    <select v-model="editDraft.model_productivity">
                      <option v-for="opt in PRODUCTIVITY_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
                    </select>
                  </div>
                  <div class="select-group">
                    <label class="select-label">版本</label>
                    <select v-model="editDraft.model_verison">
                      <option v-for="opt in VERSION_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
                    </select>
                  </div>
                </div>
              </template>

              <template v-if="activeSection==='param' && paramEditGroups.length>0">
                <div v-for="g in paramEditGroups" :key="g.name" class="param-group">
                  <div class="param-group-title">{{ g.name }}</div>
                  <table class="param-table">
                    <thead><tr><th>参数名</th><th>参数值</th></tr></thead>
                    <tbody>
                      <tr v-for="r in g.rows" :key="r.key">
                        <td>{{ r.key }}</td>
                        <td><input v-model="r.value" @blur="saveParamGroup(g)" @keydown.enter="saveParamGroup(g)" /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>

              <template v-else-if="activeSection==='disturb' && disturbColumns.length>0">
                <div ref="chartEl" class="chart-container"></div>
                <div class="var-checkboxes">
                  <label v-for="c in disturbColumns" :key="c.name">
                    <input type="checkbox" :checked="!!disturbVisible[c.name]" @change="toggleDisturbCol(c.name)" />
                    {{ c.name }}
                  </label>
                </div>
              </template>

              <div v-else class="edit-right-empty">选择左侧节点查看详情</div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- ═══ Add Modal ═══ -->
    <Modal :open="modalOpen" title="创建用例" @close="modalOpen = false" :width="460">
      <div class="add-form">
        <div class="form-group">
          <label class="form-label">用例名称</label>
          <input v-model="form.name" placeholder="输入用例名称" />
        </div>
        <div class="form-group">
          <label class="form-label">用例描述</label>
          <textarea v-model="form.description" rows="3" placeholder="输入用例描述" spellcheck="false" autocorrect="off" autocapitalize="off" />
        </div>
        <div class="form-actions">
          <button class="act-btn act-btn-cancel" @click="modalOpen = false">取消</button>
          <button class="act-btn act-btn-confirm" :disabled="submitting" @click="handleAdd">{{ submitting ? '...' : '添加' }}</button>
        </div>
      </div>
    </Modal>

    <!-- ═══ Share Modal ═══ -->
    <Modal :open="shareModalOpen" title="共享用例" @close="shareModalOpen = false" :width="460">
      <div class="share-form">
        <div class="share-subtitle">已共享用户</div>
        <div v-if="shareUsers.length > 0" class="share-list">
          <div v-for="u in shareUsers" :key="u" class="share-user-row">
            <span class="share-name">{{ u }}</span>
            <AuroraButton class="btn-outline btn-danger" size="mini" @click="handleUnshare(u)">移除</AuroraButton>
          </div>
        </div>
        <div v-else class="share-empty">暂无共享用户</div>
        <div class="share-add-row">
          <input v-model="shareNewUser" placeholder="输入用户名" class="share-input" />
          <AuroraButton class="btn-outline btn-primary-fill" @click="handleShare">添加</AuroraButton>
        </div>
      </div>
    </Modal>

    <!-- ═══ Task Modal ═══ -->
    <Modal :open="taskModalOpen" title="创建仿真任务" @close="taskModalOpen = false" :width="700">
      <div class="task-diff">
        <div class="diff-section-title">参数变更预览</div>
        <table v-if="diffRows.length > 0" class="diff-table">
          <thead><tr><th>参数路径</th><th>原值</th><th>新值</th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in diffRows" :key="i">
              <td class="diff-path">{{ r.path }}</td>
              <td class="diff-old">{{ r.old }}</td>
              <td class="diff-new">{{ r.new }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="diff-empty">无变更</div>
        <div class="task-actions">
          <button class="act-btn act-btn-cancel" @click="taskModalOpen = false">取消</button>
          <button class="act-btn act-btn-confirm" :disabled="taskSubmitting" @click="handleRunTask">{{ taskSubmitting ? '...' : '运行' }}</button>
        </div>
      </div>
    </Modal>

    <!-- ═══ Delete Confirm Modal ═══ -->
    <Modal :open="deleteModalOpen" title="确认删除" @close="deleteModalOpen = false" :width="400">
      <div class="delete-confirm">
        <p class="delete-msg">确定要删除用例 <b>{{ deleteTarget?.name }}</b> 吗？</p>
        <p class="delete-hint">此操作不可撤销</p>
        <div class="delete-actions">
          <button class="act-btn act-btn-cancel" @click="deleteModalOpen = false">取消</button>
          <button class="act-btn act-btn-confirm" :disabled="deleting" @click="handleDelete">{{ deleting ? '...' : '确认' }}</button>
        </div>
      </div>
    </Modal>

    <!-- Result Modal -->
    <Modal :open="resultModal.show" title="提示" @close="resultModal.show = false" :width="400">
      <div class="result-confirm">
        <p class="result-msg">{{ resultModal.message }}</p>
        <div class="result-actions">
          <button class="act-btn act-btn-confirm" @click="resultModal.show = false">确定</button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick, h, onMounted } from 'vue'
import type { CaseModel, ModelInfoMap, DiffRow, DisturbanceDirNode, DisturbanceColumn } from '../types/api'
import {
  queueCases, addCase, updateCase, queueModelInfo, queueDisturbances,
  getDisturbanceInfo, shareCase, unshareCase, getCaseShares, diffCase, addTasks, runTasks,
  getCurrentUser,
} from '../api/index'
import { AuroraButton } from '@aurora-design/vue'
import Modal from '../components/Modal.vue'
import TreeSection from '../components/TreeSection.vue'
import uPlot from '../lib/uplot/uPlot.esm.js'
import '../lib/uplot/uPlot.min.css'

// ═══════ Constants ═══════
const PRODUCTIVITY_OPTIONS = ['100WPH', '150WPH']
const VERSION_OPTIONS = ['3X', '5X']

// ═══════ Case List State ═══════
const cases = ref<CaseModel[]>([])
const loading = ref(true)
const modalOpen = ref(false)
const submitting = ref(false)
const form = reactive<{ name: string; description: string }>({ name: '', description: '' })
const editing = reactive<{ id: number | null; field: string }>({ id: null, field: '' })
const editValue = ref('')

// ═══════ Edit Panel State ═══════
const editCase = ref<CaseModel | null>(null)
const editDraft = reactive<Record<string, any>>({})
const saving = ref(false)
const resultModal = reactive<{ show: boolean; message: string }>({ show: false, message: '' })
const modelInfo = ref<ModelInfoMap>({})

// ═══════ Delete Confirm State ═══════
const deleteModalOpen = ref(false)
const deleteTarget = ref<CaseModel | null>(null)
const deleting = ref(false)
const activeSection = ref('')

// Tree loaded flags (lazy loading)
const trees = reactive<{ model: boolean; param: boolean; disturb: boolean; indicator: boolean }>({ model: false, param: false, disturb: false, indicator: false })

// Model tree
const systems = computed<string[]>(() => Object.keys(modelInfo.value))

// Split pane
const splitRatio = ref(0.5)
const isResizing = ref(false)
const leftPanelWidth = ref(300)
const isResizingLeft = ref(false)

// Share state
const shareModalOpen = ref(false)
const shareCaseId = ref<number | null>(null)
const shareUsers = ref<string[]>([])
const shareNewUser = ref('')

// Task state
const taskModalOpen = ref(false)
const diffData = ref<DiffRow[]>([])
const taskSubmitting = ref(false)

const diffRows = computed(() => {
  if (!Array.isArray(diffData.value)) return []
  return diffData.value.map(r => ({
    path: r.path,
    old: r.old_value == null ? '' : typeof r.old_value === 'object' ? JSON.stringify(r.old_value) : String(r.old_value),
    new: r.new_value == null ? '' : typeof r.new_value === 'object' ? JSON.stringify(r.new_value) : String(r.new_value),
  }))
})

// Param tree state
const paramVars = ref<Record<string, any>>({})
const selParamPath = ref('')
const paramExpanded = reactive<Record<string, boolean>>({})
const paramEditGroups = ref<Array<{ name: string; path: string; rows: Array<{ key: string; value: string; orig: unknown }> }>>([])

// Disturb tree state
const disturbTree = ref<DisturbanceDirNode>({})
const disturbChecked = reactive<Record<string, boolean>>({})
const disturbExpanded = reactive<Record<string, boolean>>({})
const selDisturbFile = ref('')
const disturbColumns = ref<DisturbanceColumn[]>([])
const disturbVisible = reactive<Record<string, boolean>>({})
const chartEl = ref<HTMLDivElement | null>(null)
let chartInst: any = null
let disturbInitDone = false

// ═══════ Recursive Tree Components ═══════
const isObject = v => v && typeof v === 'object' && !Array.isArray(v)
const isLastLayer = v => isObject(v) && Object.values(v).every(cv => !isObject(cv))

const TreeNode = {
  name: 'TreeNode', props: ['name','value','path','selPath','expanded'],
  emits: ['toggle','select'],
  setup(p,{emit}) {
    return () => {
      const nested = isObject(p.value), childLast = isLastLayer(p.value)
      return h('div',{class:'tree-node'},[
        h('label',{class:{selected:p.selPath===p.path},onClick:()=>emit('select',p.path)},[
          nested && !childLast
            ? h('span',{class:'tree-toggle',onClick:e=>{e.stopPropagation();emit('toggle',p.path)}},p.expanded[p.path]?'▼':'▶')
            : h('span',{class:'tree-toggle',style:{visibility:'hidden'}},'▶'),
          h('span',null,p.name),
        ]),
        nested && !childLast && p.expanded[p.path]
          ? h('div',{class:'tree-children'},
              Object.entries(p.value).map(([k,v])=>h(TreeNode,{
                key:k,name:k,value:v,path:`${p.path}.${k}`,
                selPath:p.selPath,expanded:p.expanded,
                onToggle:pp=>emit('toggle',pp),onSelect:pp=>emit('select',pp),
              })))
          : null,
      ])
    }
  },
}

const DistTreeNode = {
  name: 'DistTreeNode', props: ['name','value','path','checked','expanded','selFile'],
  emits: ['toggle','check','leafClick'],
  setup(p,{emit}) {
    return () => {
      const v = p.value
      if (!v || typeof v !== 'object') return null
      const dirs = v.dirs || {}
      const files = v.files || []
      const nodes = []
      if (Object.keys(dirs).length > 0) {
        nodes.push(h('div',{class:'tree-node'},[
          h('label',null,[
            h('span',{class:'tree-toggle',onClick:()=>emit('toggle',p.path)},p.expanded[p.path]?'▼':'▶'),
            h('span',null,p.name),
          ]),
        ]))
        if (p.expanded[p.path]) {
          nodes.push(h('div',{class:'tree-children'},
            Object.entries(dirs).map(([k,sub])=>h(DistTreeNode,{
              key:k,name:k,value:sub,path:p.path?`${p.path}/${k}`:k,
              checked:p.checked,expanded:p.expanded,selFile:p.selFile,
              onToggle:pp=>emit('toggle',pp),onCheck:pp=>emit('check',pp),onLeafClick:pp=>emit('leafClick',pp),
            }))))
        }
      }
      if (files.length > 0) {
        const fileNodes = files.map(f=>
          h('div',{key:f.path,class:'tree-node'},[
            h('label',null,[
              h('span',{class:'tree-toggle',style:{visibility:'hidden'}},'▶'),
              h('input',{type:'checkbox',checked:!!p.checked[f.path],onChange:()=>emit('check',f.path)}),
              h('span',{style:{cursor:'pointer',color:p.selFile===f.path?'var(--accent)':undefined},onClick:()=>emit('leafClick',f.path)},f.name),
            ]),
          ]))
        nodes.push(h('div',{class:'tree-children'},fileNodes))
      }
      return nodes.length ? nodes : null
    }
  },
}

const paramEntries = computed(() => Object.entries(paramVars.value))
const disturbEntries = computed(() => {
  const dirs = disturbTree.value?.dirs
  return dirs ? Object.entries(dirs) : []
})

// ═══════ Load Cases ═══════
onMounted(async () => {
  try { const r = await queueCases(); if (r.success) cases.value = r.data }
  catch (e) { console.error('加载用例失败:', e) }
  finally { loading.value = false }
})

// ═══════ Inline Edit ═══════
function startInline(c, field) { editing.id = c.id; editing.field = field; editValue.value = c[field] || '' }
function cancelInline() { editing.id = null; editing.field = '' }

async function saveInline(c, field) {
  const val = editValue.value
  editing.id = null; editing.field = ''
  if (val === (c[field]||'')) return
  try {
    const body = buildCaseBody(c); body[field] = val
    const r = await updateCase(c.id, body)
    if (r.success) { c[field] = val } else { resultModal.message = r.message; resultModal.show = true }
  } catch (e) { console.error('更新失败:', e) }
}

function buildCaseBody(src) {
  return {
    name: src.name||'', description: src.description||'', create_by: src.create_by||getCurrentUser(),
    sys_name: src.sys_name||'', model_name: src.model_name||'',
    model_verison: src.model_verison||'', model_productivity: src.model_productivity||'',
    model_param: src.model_param||'', disturbance: src.disturbance||'',
  }
}

async function openEdit(c) {
  editCase.value = c
  Object.assign(editDraft, c)
  if (!modelInfo.value || Object.keys(modelInfo.value).length === 0) {
    try { const r = await queueModelInfo(); if (r.success) modelInfo.value = r.data } catch {}
  }
  // Reset all tree state
  Object.keys(trees).forEach(k => trees[k] = false)
  Object.keys(paramExpanded).forEach(k => delete paramExpanded[k])
  Object.keys(disturbExpanded).forEach(k => delete disturbExpanded[k])
  Object.keys(disturbChecked).forEach(k => delete disturbChecked[k])
  selParamPath.value = ''
  paramEditGroups.value = []
  disturbTree.value = {}
  disturbColumns.value = []
  selDisturbFile.value = ''
  disturbInitDone = false
  activeSection.value = ''
  if (chartInst) { chartInst.destroy(); chartInst = null }
  // Load param vars from model_param or modelInfo
  initParamVars()
}

function normalizeTypes(obj) {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(normalizeTypes)
  if (typeof obj === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(obj)) out[k] = normalizeTypes(v)
    return out
  }
  if (typeof obj === 'string') {
    if (obj === '') return null
    if (obj === 'true' || obj === 'True') return true
    if (obj === 'false' || obj === 'False') return false
    if (obj === 'null' || obj === 'None') return null
    const n = Number(obj)
    if (!Number.isNaN(n) && obj.trim() !== '') return n
  }
  return obj
}

function initParamVars() {
  let src = {}
  if (editDraft.model_param) {
    try { src = normalizeTypes(JSON.parse(editDraft.model_param)) } catch {}
  } else if (editDraft.sys_name && modelInfo.value[editDraft.sys_name]?.variables) {
    src = modelInfo.value[editDraft.sys_name].variables
  } else if (Object.keys(modelInfo.value).length > 0) {
    for (const [sys, info] of Object.entries(modelInfo.value)) {
      if (info.variables) src[sys] = info.variables
    }
  }
  paramVars.value = src
}

// ═══════ Section Activation ═══════
function activateSection(key) {
  activeSection.value = key
  // load model info on first activation
  if (key === 'model' && Object.keys(modelInfo.value).length === 0) {
    queueModelInfo().then(r => { if (r.success) modelInfo.value = r.data })
  }
  if (!editDraft.model_productivity) editDraft.model_productivity = PRODUCTIVITY_OPTIONS[0]
  if (!editDraft.model_verison) editDraft.model_verison = VERSION_OPTIONS[0]
}

// ═══════ Toggle Tree (lazy load) ═══════
async function toggleTree(key) {
  // Toggle
  trees[key] = !trees[key]
  if (!trees[key]) { activeSection.value = ''; return }

  activeSection.value = key

  if (key === 'model') {
    if (Object.keys(modelInfo.value).length === 0) {
      try { const r = await queueModelInfo(); if (r.success) modelInfo.value = r.data } catch {}
    }
    if (!editDraft.model_productivity) editDraft.model_productivity = PRODUCTIVITY_OPTIONS[0]
    if (!editDraft.model_verison) editDraft.model_verison = VERSION_OPTIONS[0]
  }

  if (key === 'param') {
    // vars already initialized in openEdit / initParamVars
  }

  if (key === 'disturb') {
    if (Object.keys(disturbTree.value).length === 0) {
      try {
        const r = await queueDisturbances()
        if (r.success) {
          disturbTree.value = r.data
          function expandAll(node, path='') {
            const keys = {}
            const dirs = node.dirs || {}
            Object.entries(dirs).forEach(([k,v]) => {
              const p = path?`${path}/${k}`:k
              keys[p] = true
              Object.assign(keys, expandAll(v, p))
            })
            return keys
          }
          Object.assign(disturbExpanded, expandAll(r.data))
        }
      } catch {}
    }
    if (!disturbInitDone && editDraft.disturbance) {
      try {
        const d = JSON.parse(editDraft.disturbance)
        if (d?.length > 0) { d.forEach(x => { if (x.checked) disturbChecked[x.path] = true }); disturbInitDone = true }
      } catch {}
    }
  }

  if (key === 'indicator') {
    // nothing to load
  }
}

// ═══════ Tree Interactions ═══════
function onSystemChange(sys) {
  editDraft.sys_name = sys; editDraft.model_name = sys
  initParamVars()
}

function onParamSelect(path) {
  selParamPath.value = path
  activeSection.value = 'param'
  const parts = path.split('.')
  let node = paramVars.value
  for (const p of parts) { if (!isObject(node)) { node = undefined; break }; node = node[p] }
  if (!isObject(node)) { paramEditGroups.value = []; return }
  const entries = Object.entries(node)
  const hasNested = entries.some(([,v]) => isObject(v))

  function fmt(v) {
    if (v === null || v === undefined) return ''
    if (Array.isArray(v)) return JSON.stringify(v)
    return String(v)
  }

  if (!hasNested) {
    paramEditGroups.value = [{
      name: parts[parts.length-1], path,
      rows: entries.map(([k,v]) => ({ key:k, value: fmt(v), orig: v })),
    }]
    return
  }
  if (entries.every(([,v]) => isLastLayer(v))) {
    paramEditGroups.value = entries.map(([cn,cv]) => ({
      name: cn, path: `${path}.${cn}`,
      rows: Object.entries(cv).map(([k,v]) => ({ key:k, value: fmt(v), orig: v })),
    }))
    return
  }
  paramEditGroups.value = []
}

function coerceByType(val, orig) {
  if (val === '' && (orig === null || orig === undefined)) return null
  const t = typeof orig
  if (t === 'number') return Number.isInteger(orig) ? parseInt(val, 10) : parseFloat(val)
  if (t === 'boolean') return val === 'true' || val === '1'
  return val
}

function saveParamGroup(group) {
  const parts = group.path.split('.')
  const nv = JSON.parse(JSON.stringify(paramVars.value))
  let node = nv
  for (const p of parts) node = node[p]
  group.rows.forEach(r => { node[r.key] = coerceByType(r.value, r.orig) })
  paramVars.value = nv
  editDraft.model_param = JSON.stringify(nv)
}

function onDisturbCheck(fullPath) {
  if (!disturbInitDone) disturbInitDone = true
  if (disturbChecked[fullPath]) delete disturbChecked[fullPath]
  else disturbChecked[fullPath] = true
  const dist = Object.entries(disturbChecked).filter(([,v])=>v).map(([k])=>({path:k,name:k.split(/[/\\]/).pop(),checked:true}))
  editDraft.disturbance = JSON.stringify(dist)
}

async function onDisturbLeafClick(filePath) {
  selDisturbFile.value = filePath
  activeSection.value = 'disturb'
  // 清空旧数据，避免显示前一次的内容
  disturbColumns.value = []
  if (chartInst) { chartInst.destroy(); chartInst = null }
  try {
    const r = await getDisturbanceInfo(filePath)
    if (r.success && r.data?.columns) {
      disturbColumns.value = r.data.columns
      r.data.columns.forEach(c => { if (!(c.name in disturbVisible)) disturbVisible[c.name] = true })
    }
  } catch (e) { console.error('加载扰动数据失败:', e) }
}

function toggleDisturbCol(name) { disturbVisible[name] = !disturbVisible[name] }

// ═══════ Chart ═══════
watch([disturbColumns, disturbVisible], async () => {
  await nextTick()
  if (!chartEl.value || disturbColumns.value.length===0) {
    if (chartInst) { chartInst.destroy(); chartInst = null }
    return
  }
  const active = disturbColumns.value.filter(c => disturbVisible[c.name])
  // 过滤掉数据全为空的列
  const nonEmpty = active.filter(c => c.data && c.data.some(v => v != null))
  if (nonEmpty.length===0) {
    if (chartInst) { chartInst.destroy(); chartInst = null }
    return
  }
  const xData = nonEmpty[0].data.map((_,i)=>i)
  const series = [{},...nonEmpty.map((c,i)=>({label:c.name,stroke:`hsl(${(i*60)%360},70%,50%)`,width:1.5}))]
  const data = [xData,...nonEmpty.map(c=>c.data.map(v=>v==null?null:Number(v))||0)]
  if (chartInst) chartInst.destroy()
  chartInst = new (uPlot as any)({width:chartEl.value.offsetWidth,height:400,cursor:{show:true},legend:{show:true},scales:{x:{time:false}},axes:[{},{stroke:'#888',grid:{stroke:'#e8e8e8'}}],series}, data, chartEl.value)
})

// ═══════ Save / Copy ═══════
async function handleSave() {
  saving.value = true
  try {
    const body = buildCaseBody({ ...editCase.value, ...editDraft })
    const r = await updateCase(editCase.value.id, body)
    if (r.success) {
      Object.assign(editCase.value, editDraft)
      const idx = cases.value.findIndex(c => c.id === editCase.value.id)
      if (idx >= 0) cases.value[idx] = { ...editCase.value }
      resultModal.message = '保存成功'
      resultModal.show = true
    } else { resultModal.message = r.message || '保存失败'; resultModal.show = true }
  } catch (e) { resultModal.message = '保存失败'; resultModal.show = true }
  finally { saving.value = false }
}

async function handleCopy(c) {
  try {
    const r = await addCase({ ...buildCaseBody(c), name: c.name+'_copy', create_by: getCurrentUser() })
    if (r.success) {
      const list = await queueCases()
      if (list.success) cases.value = list.data
    } else { /* error shown by request interceptor */ }
  } catch (e) { console.error('复制失败:', e) }
}

function confirmDelete(c) {
  deleteTarget.value = c
  deleteModalOpen.value = true
}

async function handleDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    const body = { ...buildCaseBody(deleteTarget.value), is_deleted: true }
    const r = await updateCase(deleteTarget.value.id, body)
    if (r.success) {
      deleteModalOpen.value = false
      if (editCase.value?.id === deleteTarget.value.id) editCase.value = null
      const list = await queueCases()
      if (list.success) cases.value = list.data
    }
  } catch (e) { console.error('删除失败:', e) }
  finally { deleting.value = false }
}

async function handleAdd() {
  if (!form.name.trim() || !form.description.trim()) return
  submitting.value = true
  try {
    const r = await addCase({
      name: form.name.trim(), description: form.description.trim(), create_by: getCurrentUser(),
      sys_name:'', model_name:'', model_verison:'', model_productivity:'', model_param:'', disturbance:'',
    })
    if (r.success) {
      form.name = ''; form.description = ''; modalOpen.value = false
      const list = await queueCases()
      if (list.success) {
        cases.value = list.data
        const found = list.data.find(c => c.id === r.data.id)
        if (found) openEdit(found)
      }
    } else { /* error shown by request interceptor */ }
  } catch (e) { console.error('添加失败:', e) }
  finally { submitting.value = false }
}

// ═══════ Resize Split Pane (horizontal - case list / edit panel) ═══════
function startResize(e: MouseEvent): void {
  isResizing.value = true
  const container = (e.target as HTMLElement).parentElement!
  const containerTop = container.getBoundingClientRect().top
  const containerHeight = container.offsetHeight
  document.body.style.userSelect = 'none'
  function onMove(ev) {
    const newRatio = (ev.clientY - containerTop) / containerHeight
    splitRatio.value = Math.min(0.8, Math.max(0.2, newRatio))
  }
  function onUp() {
    isResizing.value = false
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function startResizeLeft(e: MouseEvent): void {
  isResizingLeft.value = true
  const editBody = (e.target as HTMLElement).parentElement!
  const bodyLeft = editBody.getBoundingClientRect().left
  const bodyWidth = editBody.offsetWidth
  document.body.style.userSelect = 'none'
  function onMove(ev: MouseEvent): void {
    const newWidth = ev.clientX - bodyLeft
    leftPanelWidth.value = Math.min(bodyWidth * 0.6, Math.max(180, newWidth))
  }
  function onUp(): void {
    isResizingLeft.value = false
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// ═══════ Share ═══════
async function openShare(c) {
  shareCaseId.value = c.id
  shareModalOpen.value = true
  try {
    const r = await getCaseShares(c.id)
    if (r.success) shareUsers.value = r.data.map(s => s.shared_to_user)
  } catch {}
}

async function handleShare() {
  if (!shareNewUser.value.trim()) return
  const r = await shareCase(shareCaseId.value, shareNewUser.value.trim())
  if (r.success) {
    shareUsers.value.push(shareNewUser.value.trim())
    shareNewUser.value = ''
  }
}

async function handleUnshare(user) {
  const r = await unshareCase(shareCaseId.value, user)
  if (r.success) shareUsers.value = shareUsers.value.filter(u => u !== user)
}

// ═══════ Task ═══════
async function openTaskModal() {
  await handleSave()
  if (!editCase.value) return
  const body = buildCaseBody({ ...editCase.value, ...editDraft })
  try {
    const r = await diffCase(editCase.value.id, body)
    if (r.success) { diffData.value = r.data; taskModalOpen.value = true }
  } catch { resultModal.message = '获取差异失败'; resultModal.show = true }
}

async function handleRunTask() {
  taskSubmitting.value = true
  try {
    await handleSave()
    if (!editCase.value) return
    const r = await addTasks(editCase.value.id)
    if (!r.success) return
    const taskIds = r.data.task_ids
    const runR = await runTasks(taskIds)
    if (runR.success) {
      taskModalOpen.value = false
      resultModal.message = `任务已提交 (ID: ${taskIds.join(',')})`
      resultModal.show = true
    }
  } catch { resultModal.message = '任务提交失败'; resultModal.show = true }
  finally { taskSubmitting.value = false }
}
</script>

<style scoped>
.case-page { display:flex; flex-direction:column; gap:20px; }

/* Split pane */
.split-container { display:flex; flex-direction:column; height:calc(100vh - 120px); }
.case-list { background:var(--panel-bg); border-radius:var(--radius); box-shadow:0 1px 3px rgba(0,0,0,0.08); flex-shrink:0; }
.edit-panel { background:var(--panel-bg); border-radius:var(--radius); box-shadow:0 1px 3px rgba(0,0,0,0.08); flex:1; overflow:auto; min-height:0; }

.resize-handle {
  height:6px; cursor:row-resize; background:var(--border); flex-shrink:0; transition:background 0.15s;
}
.resize-handle:hover, .resize-handle.dragging { background:var(--accent); }

/* Shared button style */
.btn-outline { color: var(--accent) !important; border: none !important; background: transparent !important; font-weight: 500 !important; transition: background 0.15s; }
.btn-outline:hover { background: var(--accent-light) !important; }
.btn-outline.btn-danger { color: #ef4444 !important; }
.btn-outline.btn-danger:hover { background: #fef2f2 !important; }
.btn-outline.btn-primary-fill { color: #fff !important; background: var(--accent) !important; border-radius: 6px !important; padding: 8px 20px; }
.btn-outline.btn-primary-fill:hover { opacity: 0.9 !important; background: var(--accent) !important; }

/* Table */
.page-header { display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid var(--border); }
.page-header h2 { font-size:16px; font-weight:600; }
.page-header .aurora-button { font-weight:600; font-size:14px; padding:10px 24px; border: 1px solid var(--accent) !important; border-radius: 5px !important; }
.case-list th:first-child, .case-list td:first-child { padding-left:24px; }
.case-list th:last-child, .case-list td:last-child { padding-right:24px; }
.empty { text-align:center; color:var(--text-secondary); padding:60px 0; }
.loading { text-align:center; padding:80px 0; color:var(--text-secondary); }
.editable-cell { cursor:pointer; display:inline-block; padding:2px 4px; border-radius:3px; border:1px solid transparent; min-width:40px; }
.editable-cell:hover { border-color:var(--border); background:#fafbfc; }
.inline-input { width:100%; font-size:13px; padding:2px 4px; }
.actions-cell { display:flex; gap:6px; align-items:center; }
.actions-cell .aurora-button { color: var(--accent); box-shadow: 0 1px 2px rgba(0,0,0,0.1); transition: box-shadow 0.15s, transform 0.15s; }
.actions-cell .aurora-button:hover { box-shadow: 0 2px 6px rgba(0,0,0,0.18); transform: translateY(-1px); }
.row-selected td { background:var(--accent-light); }

/* Edit Panel */
.edit-toolbar { display:flex; align-items:center; gap:16px; padding:14px 24px; border-bottom:1px solid var(--border); background:#fafbfc; }
.edit-toolbar h3 { flex:1; font-size:16px; font-weight:600; }
.toolbar-actions { display:flex; gap:8px; }

.edit-body { display:flex; flex:1; min-height:0; }

/* Left panel - tree sections */
.edit-left { flex-shrink:0; border-right:1px solid var(--border); overflow-y:auto; padding:8px 0; }
.h-resize-handle {
  width: 5px; cursor: col-resize; background: var(--border); flex-shrink: 0; transition: background 0.15s;
}
.h-resize-handle:hover, .h-resize-handle.dragging { background: var(--accent); }
.tree-section { border-bottom: 1px solid var(--border); }
.tree-section-header {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 16px; cursor: pointer; user-select: none;
  font-size: 14px; font-weight: 500; color: var(--text);
  transition: background 0.12s;
}
.tree-section-header:hover { background: #f5f7fa; }
.section-active { background: var(--accent-light); }
.tree-section-title { flex: 1; }
.edit-right { flex:1; padding:16px 20px; overflow-y:auto; }
.edit-right-empty { display:flex; align-items:center; justify-content:center; height:100%; color:#999; font-size:13px; }

/* Model select panel */
.model-select-panel { max-width:400px; }
.select-group { margin-bottom:16px; }
.select-label { display:block; font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:4px; }

.tree-content { padding:4px 0 4px 12px; }

/* Radio groups (in tree) */
.radio-group { margin-bottom:12px; }
.radio-group-title { font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:4px; }
.radio-label { display:inline-flex; align-items:center; gap:4px; margin-right:16px; cursor:pointer; font-size:13px; }

/* Param table in right panel */
.param-group { margin-bottom:16px; }
.param-group-title { font-size:13px; font-weight:600; color:var(--accent); padding:4px 0; border-bottom:2px solid var(--accent-light); margin-bottom:8px; }
.param-table { width:100%; }
.param-table th { font-size:11px; padding:4px 10px; }
.param-table td { padding:4px 10px; font-size:13px; }
.param-table input { font-size:13px; padding:4px 8px; }

/* Chart */
.chart-container { width:100%; margin-bottom:12px; }
.var-checkboxes { display:flex; flex-wrap:wrap; gap:6px 16px; margin-top:10px; padding:10px; background:#fafbfc; border-radius:4px; }
.var-checkboxes label { display:flex; align-items:center; gap:4px; font-size:12px; cursor:pointer; }

/* Modal form */
.form-group { margin-bottom: 16px; }
.form-label { display: block; font-weight: 500; font-size: 13px; color: var(--text); margin-bottom: 6px; }
.add-form textarea { resize: vertical; }
.form-actions { display: flex; justify-content: center; gap: 10px; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); }

/* Share modal */
.share-subtitle { font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 10px; }
.share-list { max-height: 200px; overflow-y: auto; }
.share-user-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); }
.share-user-row:last-child { border-bottom: none; }
.share-name { font-size: 13px; color: var(--text); }
.share-empty { color: #999; font-size: 13px; padding: 8px 0; }
.share-add-row { display: flex; gap: 8px; margin-top: 16px; }
.share-input { flex: 1; }

/* Task modal */
.diff-section-title { font-size: 13px; font-weight: 600; color: var(--accent); margin-bottom: 10px; }
.diff-table { width: 100%; font-size: 12px; }
.diff-table th { font-size: 11px; padding: 6px 10px; background: var(--accent-light); color: var(--accent); }
.diff-table td { padding: 6px 10px; font-size: 12px; }
.diff-path { font-family: monospace; font-size: 11px; color: var(--text-secondary); max-width: 260px; word-break: break-all; }
.diff-old { color: #ef4444; max-width: 160px; word-break: break-all; }
.diff-new { color: #16a34a; max-width: 160px; word-break: break-all; }
.diff-empty { text-align: center; color: var(--text-secondary); padding: 24px; font-size: 13px; }
.task-actions { display: flex; gap: 10px; margin-top: 16px; justify-content: center; padding-top: 16px; border-top: 1px solid var(--border); }

/* Delete confirm modal */
.delete-confirm { text-align: center; }
.delete-msg { font-size: 14px; color: var(--text); margin-bottom: 6px; }
.delete-hint { font-size: 12px; color: #999; margin-bottom: 16px; }
.delete-actions { display: flex; gap: 10px; justify-content: center; align-items: center; padding-top: 16px; border-top: 1px solid var(--border); }
.act-btn {
  min-width: 88px; padding: 8px 24px; border: none; border-radius: 6px;
  font-size: 13px; font-weight: 500; cursor: pointer; transition: opacity 0.15s;
}
.act-btn:hover { opacity: 0.9; }
.act-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.act-btn-cancel { background: var(--accent); color: #fff; }
.act-btn-confirm { background: var(--accent); color: #fff; }

/* Result modal */
.result-confirm { text-align: center; }
.result-msg { font-size: 14px; color: var(--text); margin-bottom: 16px; }
.result-actions { display: flex; gap: 10px; justify-content: center; align-items: center; padding-top: 16px; border-top: 1px solid var(--border); }
</style>
