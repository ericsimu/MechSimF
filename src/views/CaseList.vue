<template>
  <div class="case-page">
    <!-- ═══ Case List Table ═══ -->
    <div class="case-list">
      <div class="page-header">
        <h2>用例列表</h2>
        <button class="btn-primary" @click="modalOpen = true">添加 Case</button>
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
            <td class="actions-cell">
              <button class="btn-primary" @click="openEdit(c)">编辑</button>
              <button class="btn-default" @click="handleCopy(c)">复制</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="loading">加载中...</div>
    </div>

    <!-- ═══ Inline Edit Panel ═══ -->
    <div v-if="editCase" class="edit-panel">
      <div class="edit-toolbar">
        <h3>{{ editCase.name }}</h3>
        <div class="toolbar-actions">
          <button class="btn-default" @click="handleCopy(editCase)">复制</button>
          <button class="btn-primary" :disabled="saving" @click="handleSave">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>

      <div class="edit-body">
        <!-- Left: 4 tree sections -->
        <div class="edit-left">
          <TreeSection title="模型选择" :expanded="trees.model" @toggle="toggleTree('model')">
            <div v-if="trees.model" class="tree-content">
              <div class="radio-group">
                <div class="radio-group-title">产率</div>
                <label v-for="opt in PRODUCTIVITY_OPTIONS" :key="opt" class="radio-label">
                  <input type="radio" :value="opt" v-model="editDraft.model_productivity" @change="emitDraft" />
                  {{ opt }}
                </label>
              </div>
              <div class="radio-group">
                <div class="radio-group-title">版本</div>
                <label v-for="opt in VERSION_OPTIONS" :key="opt" class="radio-label">
                  <input type="radio" :value="opt" v-model="editDraft.model_verison" @change="emitDraft" />
                  {{ opt }}
                </label>
              </div>
              <div class="radio-group">
                <div class="radio-group-title">系统选择</div>
                <div v-if="systems.length===0" style="color:#999;font-size:12px">暂无系统数据</div>
                <label v-for="s in systems" :key="s" class="radio-label" style="display:block;margin-bottom:4px">
                  <input type="radio" :value="s" v-model="editDraft.sys_name" @change="onSystemChange(s)" />
                  {{ s }}
                </label>
              </div>
            </div>
          </TreeSection>

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
            </div>
          </TreeSection>

          <TreeSection title="指标分析" :expanded="trees.indicator" @toggle="toggleTree('indicator')">
            <div v-if="trees.indicator" class="tree-content" style="color:#999;font-size:13px;padding:12px">
              此页面暂未填充内容
            </div>
          </TreeSection>
        </div>

        <!-- Right: Content panel -->
        <div class="edit-right">
          <!-- Param Config right panel -->
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

          <!-- Disturbance right panel -->
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

    <!-- ═══ Add Modal ═══ -->
    <Modal :open="modalOpen" title="添加用例" @close="modalOpen = false">
      <div class="add-form">
        <label>用例名称</label>
        <input v-model="form.name" placeholder="输入用例名称" />
        <label>用例描述</label>
        <textarea v-model="form.description" rows="3" placeholder="输入用例描述" />
        <div class="form-actions">
          <button class="btn-primary" :disabled="submitting" @click="handleAdd">
            {{ submitting ? '提交中...' : 'Add' }}
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, h, onMounted } from 'vue'
import { queueCases, addCase, updateCase, queueModelInfo, queueDisturbances, getDisturbanceInfo } from '../api/index.js'
import Modal from '../components/Modal.vue'
import TreeSection from '../components/TreeSection.vue'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'

// ═══════ Constants ═══════
const PRODUCTIVITY_OPTIONS = ['100WPH', '150WPH']
const VERSION_OPTIONS = ['3X', '5X']

// ═══════ Case List State ═══════
const cases = ref([])
const loading = ref(true)
const modalOpen = ref(false)
const submitting = ref(false)
const form = reactive({ name: '', description: '' })
const editing = reactive({ id: null, field: '' })
const editValue = ref('')

// ═══════ Edit Panel State ═══════
const editCase = ref(null)
const editDraft = reactive({})
const saving = ref(false)
const modelInfo = ref({})
const activeSection = ref('')

// Tree loaded flags (lazy loading)
const trees = reactive({ model: false, param: false, disturb: false, indicator: false })

// Model tree
const systems = computed(() => Object.keys(modelInfo.value))

// Param tree state
const paramVars = ref({})
const selParamPath = ref('')
const paramExpanded = reactive({})
const paramEditGroups = ref([])

// Disturb tree state
const disturbTree = ref({})
const disturbChecked = reactive({})
const disturbExpanded = reactive({})
const selDisturbFile = ref('')
const disturbColumns = ref([])
const disturbVisible = reactive({})
const chartEl = ref(null)
let chartInst = null
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
      const isDir = p.value && typeof p.value === 'object' && !p.value._files
      const hasFiles = p.value?._files?.length > 0
      const nodes = []
      if (isDir || hasFiles) {
        nodes.push(h('div',{class:'tree-node'},[
          h('label',null,[
            h('span',{class:'tree-toggle',onClick:()=>emit('toggle',p.path)},p.expanded[p.path]?'▼':'▶'),
            h('span',null,p.name),
          ]),
        ]))
        if (p.expanded[p.path]) {
          if (isDir) {
            nodes.push(h('div',{class:'tree-children'},
              Object.entries(p.value).map(([k,v])=>h(DistTreeNode,{
                key:k,name:k,value:v,path:`${p.path}/${k}`,
                checked:p.checked,expanded:p.expanded,selFile:p.selFile,
                onToggle:pp=>emit('toggle',pp),onCheck:pp=>emit('check',pp),onLeafClick:pp=>emit('leafClick',pp),
              }))))
          }
          if (hasFiles) {
            const files = p.value._files.map(f=>
              h('div',{key:f.path,class:'tree-node'},[
                h('label',null,[
                  h('span',{class:'tree-toggle',style:{visibility:'hidden'}},'▶'),
                  h('input',{type:'checkbox',checked:!!p.checked[f.path],onChange:()=>emit('check',f.path)}),
                  h('span',{style:{cursor:'pointer',color:p.selFile===f.path?'var(--accent)':undefined},onClick:()=>emit('leafClick',f.path)},f.name),
                ]),
              ]))
            nodes.push(h('div',{class:'tree-children'},files))
          }
        }
      }
      return nodes.length ? nodes : null
    }
  },
}

const paramEntries = computed(() => Object.entries(paramVars.value))
const disturbEntries = computed(() => Object.entries(disturbTree.value))

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
    if (r.success) c[field] = val; else alert(r.message)
  } catch (e) { console.error('更新失败:', e) }
}

function buildCaseBody(src) {
  return {
    name: src.name||'', description: src.description||'', create_by: src.create_by||'',
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

function initParamVars() {
  let src = {}
  if (editDraft.model_param) {
    try { src = JSON.parse(editDraft.model_param) } catch {}
  } else if (editDraft.sys_name && modelInfo.value[editDraft.sys_name]?.variables) {
    src = modelInfo.value[editDraft.sys_name].variables
  } else if (Object.keys(modelInfo.value).length > 0) {
    for (const [sys, info] of Object.entries(modelInfo.value)) {
      if (info.variables) src[sys] = info.variables
    }
  }
  paramVars.value = src
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
            Object.entries(node).forEach(([k,v]) => {
              if (k!=='_files' && typeof v==='object' && !Array.isArray(v)) {
                const p = path?`${path}/${k}`:k
                keys[p] = true
                Object.assign(keys, expandAll(v, p))
              }
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

function emitDraft() {
  // reactivity handles model_productivity / model_verison
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
  if (!hasNested) {
    paramEditGroups.value = [{
      name: parts[parts.length-1], path,
      rows: entries.map(([k,v]) => ({ key:k, value:Array.isArray(v)?JSON.stringify(v):String(v??'') })),
    }]
    return
  }
  if (entries.every(([,v]) => isLastLayer(v))) {
    paramEditGroups.value = entries.map(([cn,cv]) => ({
      name: cn, path: `${path}.${cn}`,
      rows: Object.entries(cv).map(([k,v]) => ({ key:k, value:Array.isArray(v)?JSON.stringify(v):String(v??'') })),
    }))
    return
  }
  paramEditGroups.value = []
}

function saveParamGroup(group) {
  const parts = group.path.split('.')
  const nv = JSON.parse(JSON.stringify(paramVars.value))
  let node = nv
  for (const p of parts) node = node[p]
  group.rows.forEach(r => { node[r.key] = r.value })
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
  if (!chartEl.value || disturbColumns.value.length===0) return
  const active = disturbColumns.value.filter(c => disturbVisible[c.name])
  if (active.length===0) { if(chartInst){chartInst.destroy();chartInst=null}; return }
  const xData = active[0].data.map((_,i)=>i)
  const series = [{},...active.map((c,i)=>({label:c.name,stroke:`hsl(${(i*60)%360},70%,50%)`,width:1.5}))]
  const data = [xData,...active.map(c=>c.data.map(v=>v==null?null:Number(v))||0)]
  if (chartInst) chartInst.destroy()
  chartInst = new uPlot({width:chartEl.value.offsetWidth,height:400,cursor:{show:true},legend:{show:true},scales:{x:{time:false}},axes:[{},{stroke:'#888',grid:{stroke:'#e8e8e8'}}],series}, data, chartEl.value)
})

// ═══════ Save / Copy ═══════
async function handleSave() {
  saving.value = true
  try {
    const body = {
      ...buildCaseBody(editCase.value),
      name: editDraft.name || editCase.value.name,
      description: editDraft.description || editCase.value.description || '',
      sys_name: editDraft.sys_name || '',
      model_name: editDraft.sys_name || '',
      model_verison: editDraft.model_verison || '',
      model_productivity: editDraft.model_productivity || '',
      model_param: editDraft.model_param || '',
      disturbance: editDraft.disturbance || '',
    }
    const r = await updateCase(editCase.value.id, body)
    if (r.success) {
      Object.assign(editCase.value, editDraft)
      const idx = cases.value.findIndex(c => c.id === editCase.value.id)
      if (idx >= 0) cases.value[idx] = { ...editCase.value }
      alert('保存成功')
    } else { alert(r.message) }
  } catch (e) { console.error('保存失败:', e); alert('保存失败') }
  finally { saving.value = false }
}

async function handleCopy(c) {
  try {
    const r = await addCase({ ...buildCaseBody(c), name: c.name+'_copy', create_by: c.create_by||'' })
    if (r.success) {
      const list = await queueCases()
      if (list.success) cases.value = list.data
    } else { alert(r.message) }
  } catch (e) { console.error('复制失败:', e) }
}

async function handleAdd() {
  if (!form.name.trim() || !form.description.trim()) return
  submitting.value = true
  try {
    const r = await addCase({
      name: form.name.trim(), description: form.description.trim(), create_by: '',
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
    } else { alert(r.message) }
  } catch (e) { console.error('添加失败:', e) }
  finally { submitting.value = false }
}
</script>

<style scoped>
.case-page { display:flex; flex-direction:column; gap:20px; }

/* Table */
.case-list { background:var(--panel-bg); border-radius:var(--radius); box-shadow:0 1px 3px rgba(0,0,0,0.08); }
.page-header { display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid var(--border); }
.page-header h2 { font-size:16px; font-weight:600; }
.case-list th:first-child, .case-list td:first-child { padding-left:24px; }
.case-list th:last-child, .case-list td:last-child { padding-right:24px; }
.empty { text-align:center; color:var(--text-secondary); padding:60px 0; }
.loading { text-align:center; padding:80px 0; color:var(--text-secondary); }
.editable-cell { cursor:pointer; display:inline-block; padding:2px 4px; border-radius:3px; border:1px solid transparent; min-width:40px; }
.editable-cell:hover { border-color:var(--border); background:#fafbfc; }
.inline-input { width:100%; font-size:13px; padding:2px 4px; }
.actions-cell { display:flex; gap:8px; }
.row-selected td { background:var(--accent-light); }

/* Edit Panel */
.edit-panel { background:var(--panel-bg); border-radius:var(--radius); box-shadow:0 1px 3px rgba(0,0,0,0.08); }
.edit-toolbar { display:flex; align-items:center; gap:16px; padding:14px 24px; border-bottom:1px solid var(--border); background:#fafbfc; }
.edit-toolbar h3 { flex:1; font-size:16px; font-weight:600; }
.toolbar-actions { display:flex; gap:8px; }

.edit-body { display:flex; min-height:500px; }

/* Left panel - tree sections */
.edit-left { width:300px; flex-shrink:0; border-right:1px solid var(--border); overflow-y:auto; max-height:600px; padding:8px 0; }
.edit-right { flex:1; padding:16px 20px; overflow-y:auto; max-height:600px; }
.edit-right-empty { display:flex; align-items:center; justify-content:center; height:100%; color:#999; font-size:13px; }

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
.add-form { display:flex; flex-direction:column; gap:6px; }
.add-form label { font-weight:500; font-size:12px; color:var(--text-secondary); margin-top:6px; }
.add-form textarea { resize:vertical; }
.form-actions { display:flex; justify-content:flex-end; margin-top:18px; }
</style>
