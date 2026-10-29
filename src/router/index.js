import { createRouter, createWebHistory } from 'vue-router'
import AdminView from '../views/AdminView.vue'
import MobileView from '../views/MobileView.vue'

const routes = [
  {
    path: '/',
    redirect: '/admin'
  },
  {
    path: '/admin',
    name: 'Admin',
    component: AdminView,
    meta: { title: 'Pickleball Queue - iPad Admin' }
  },
  {
    path: '/view',
    name: 'View',
    component: MobileView,
    meta: { title: 'Pickleball Queue - Live Player View' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  if (to.meta.title) {
    document.title = to.meta.title
  }
  next()
})

export default router
