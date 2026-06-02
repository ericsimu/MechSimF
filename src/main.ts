import { createApp } from 'vue'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { bootstrap } from '@aurora-design/vue'
import '@aurora-design/vue/dist/global.css'
import App from './App.vue'
import './style.css'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/cases' },
  {
    path: '/cases',
    name: 'CaseList',
    component: () => import('./views/CaseList.vue'),
  },
  {
    path: '/tasks',
    name: 'Tasks',
    component: () => import('./views/Tasks.vue'),
  },
  {
    path: '/data/:taskId?',
    name: 'Data',
    component: () => import('./views/DataViewer.vue'),
  },
  { path: '/data-manage', name: 'DataManage', component: () => import('./views/Placeholder.vue') },
  { path: '/tools', name: 'Tools', component: () => import('./views/Placeholder.vue') },
  { path: '/manual', name: 'Manual', component: () => import('./views/Placeholder.vue') },
  { path: '/indicators', name: 'Indicators', component: () => import('./views/Placeholder.vue') },
  { path: '/reports', name: 'Reports', component: () => import('./views/Placeholder.vue') },
  { path: '/logs', name: 'Logs', component: () => import('./views/Placeholder.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

bootstrap({
  autoLoaded: true,
  autoLoadedDelay: 300,
}, async () => {
  const app = createApp(App)
  app.use(router)
  app.mount('#aurora')
  return '#aurora'
})
