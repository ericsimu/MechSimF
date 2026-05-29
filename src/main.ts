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
