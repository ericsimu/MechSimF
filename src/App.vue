<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-brand">MechSim</div>
      <nav class="sidebar-nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          active-class="active"
        >
          {{ item.label }}
        </router-link>
      </nav>
    </aside>
    <div class="app-body">
      <header class="app-header">
        <span class="header-breadcrumb">MechSim 仿真平台</span>
      </header>
      <main class="app-main">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
const navItems = [
  { path: '/cases', label: '用例编排' },
  { path: '/tasks', label: '任务管理' },
  { path: '/data', label: '数据查看' },
]
</script>

<style scoped>
.app-shell { display: flex; min-height: 100vh; }

.sidebar {
  width: 200px;
  flex-shrink: 0;
  background: var(--sidebar-bg);
  display: flex;
  flex-direction: column;
}

.sidebar-brand {
  padding: 18px 20px;
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.5px;
}

.sidebar-nav { display: flex; flex-direction: column; padding: 8px 0; }

.nav-item {
  display: block;
  padding: 10px 20px;
  color: var(--sidebar-text);
  text-decoration: none;
  font-size: 14px;
  border-left: 3px solid transparent;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}

.nav-item:hover { color: #fff; background: rgba(255,255,255,0.06); }

.nav-item.active {
  color: var(--sidebar-active);
  background: rgba(255,255,255,0.1);
  border-left-color: var(--accent);
  font-weight: 600;
}

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

.header-breadcrumb { font-size: 13px; color: var(--text-secondary); }

.app-main { flex: 1; padding: 20px 24px; overflow-y: auto; }
</style>
