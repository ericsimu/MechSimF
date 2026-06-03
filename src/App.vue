<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-brand">MechSim</div>
      <nav class="sidebar-nav">
        <template v-for="item in navItems" :key="item.label">
          <a
            v-if="item.path"
            :class="['nav-item', { active: isActive(item.path) }]"
            @click="goTo(item.path)"
          >
            {{ item.label }}
          </a>
          <div v-else class="nav-group">
            <div class="nav-parent">{{ item.label }}</div>
            <div class="nav-sub">
              <a
                v-for="sub in item.children"
                :key="sub.label"
                :class="['nav-sub-item', { active: isActive(sub.path) }]"
                @click="goTo(sub.path)"
              >
                {{ sub.label }}
              </a>
            </div>
          </div>
        </template>
      </nav>
    </aside>
    <div class="app-body">
      <header class="app-header">
        <span class="header-breadcrumb">MechSim (机电仿真平台)</span>
      </header>
      <main class="app-main">
        <router-view />
      </main>
    </div>

    <!-- Global Error Modal -->
    <teleport to="body">
      <transition name="error-fade">
        <div v-if="errorState.show" class="error-overlay" @click.self="closeError">
          <div class="error-modal">
            <div class="error-header">
              <span class="error-title">错误</span>
            </div>
            <div class="error-body">{{ errorState.message }}</div>
            <div class="error-footer">
              <button class="error-btn" @click="closeError">确定</button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { errorState, closeError } from './api/index'

interface NavChild { path: string; label: string }
interface NavItem { path?: string; label: string; children?: NavChild[] }

const router = useRouter()
const route = useRoute()

const navItems: NavItem[] = [
  { path: '/cases', label: '用例编排' },
  { path: '/tasks', label: '任务管理' },
  {
    label: '结果分析',
    children: [
      { path: '/data', label: '数据可视化' },
      { path: '/indicators', label: '指标查看' },
      { path: '/reports', label: '报告查看' },
      { path: '/logs', label: '日志查看' },
    ],
  },
  { path: '/data-manage', label: '数据管理' },
  { path: '/tools', label: '工具箱' },
  { path: '/manual', label: '用户手册' },
]

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/')
}

function goTo(path: string) {
  router.push(path)
}
</script>

<style scoped>
.app-shell { display: flex; min-height: 100vh; }

.sidebar {
  width: 200px;
  flex-shrink: 0;
  background: linear-gradient(180deg, #0f1b3d 0%, #1e3a8a 50%, #2563eb 100%);
  display: flex;
  flex-direction: column;
}

.sidebar-brand {
  padding: 20px 20px;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.5px;
}

.sidebar-nav { display: flex; flex-direction: column; padding: 8px 0; }

.nav-item {
  display: block;
  padding: 12px 20px;
  color: rgba(255,255,255,0.85);
  text-decoration: none;
  font-size: 18px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.nav-item:hover { color: #fff; background: rgba(255,255,255,0.12); }

.nav-item.active {
  color: #fff;
  font-weight: 600;
  border: 1px solid rgba(255,255,255,0.5);
  border-radius: 4px;
}

.nav-parent {
  padding: 12px 20px 4px;
  color: rgba(255,255,255,0.5);
  font-size: 18px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.nav-sub { padding: 0 0 8px; }

.nav-sub-item {
  display: block;
  padding: 10px 20px 8px 40px;
  color: rgba(255,255,255,0.7);
  text-decoration: none;
  font-size: 15px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.nav-sub-item:hover { color: #fff; background: rgba(255,255,255,0.1); }

.nav-sub-item.active { color: #fff; font-weight: 500; }

.app-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.app-header {
  padding: 14px 24px;
  background: #fff;
  border-bottom: 1px solid var(--border);
}

.header-breadcrumb { font-size: 14px; color: var(--text); font-weight: 500; }

.app-main { flex: 1; padding: 20px 24px; overflow-y: auto; }

/* Error Modal */
.error-fade-enter-active { transition: opacity 0.15s ease; }
.error-fade-enter-from { opacity: 0; }
.error-fade-leave-active { transition: opacity 0.1s ease; }
.error-fade-leave-to { opacity: 0; }

.error-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.3);
  display: flex; align-items: center; justify-content: center; z-index: 9999;
}
.error-modal {
  background: #fff; border-radius: 8px; width: 420px; max-width: 90vw;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}
.error-header {
  padding: 16px 24px;
  border-bottom: 2px solid var(--accent);
}
.error-title { font-size: 15px; font-weight: 600; color: var(--accent); }
.error-body { padding: 24px; font-size: 14px; color: #333; line-height: 1.6; max-height: 300px; overflow-y: auto; }
.error-footer { padding: 12px 24px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; }
.error-btn {
  background: var(--accent); color: #fff; border: none; border-radius: 6px;
  padding: 8px 24px; font-size: 13px; font-weight: 500; cursor: pointer;
}
.error-btn:hover { opacity: 0.9; }
</style>
