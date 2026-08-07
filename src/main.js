import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import { bootstrapAuth, installAuthApiHooks } from './stores/authStore'
import './styles.css'
import './styles.toast-nations.css'
import './admin.css'

;(async () => {
  installAuthApiHooks()
  await bootstrapAuth()

  const app = createApp(App)

  // Глобальный перехват ошибок рендера/жизненного цикла компонентов, чтобы
  // единичный сбой не обнулял весь SPA белым экраном.
  app.config.errorHandler = (error, _instance, info) => {
    console.error('[VoidRP] Vue error:', info, error)
  }

  app.use(router).use(i18n).mount('#app')
})().catch((error) => {
  console.error('Failed to bootstrap app:', error)
})
