import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

const routes = [
  { path: '/', redirect: '/cases' },
  {
    path: '/cases',
    name: 'CaseList',
    component: () => import('./views/CaseList.vue'),
  },
  {
    path: '/tasks',
    name: 'Tasks',
    component: () => import('./views/Placeholder.vue'),
  },
  {
    path: '/data',
    name: 'Data',
    component: () => import('./views/Placeholder.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

createApp(App).use(router).mount('#app')
