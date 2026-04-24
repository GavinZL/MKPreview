import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { i18n } from './i18n'
import './assets/styles/global.css'

// Production 调试：全局错误捕获，将错误显示在页面上
function showBootError(html: string) {
  const el = document.getElementById('app-boot-errors')
  if (el) {
    el.style.display = 'block'
    el.innerHTML += html
  }
}
window.onerror = function (msg, url, line, col, err) {
  showBootError(`<div style="color:red;padding:4px 0;border-bottom:1px solid #333;font-family:monospace;font-size:12px">[${line}:${col}] ${msg}</div>`)
  console.error('[Global Error]', msg, url, line, col, err)
  return false
}
window.onunhandledrejection = function (e) {
  showBootError(`<div style="color:orange;padding:4px 0;border-bottom:1px solid #333;font-family:monospace;font-size:12px">[UnhandledRejection] ${String(e.reason)}</div>`)
  console.error('[UnhandledRejection]', e.reason)
}

try {
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.use(i18n)
  app.mount('#app')
} catch (err) {
  console.error('[Mount Error]', err)
  const appDiv = document.getElementById('app')
  if (appDiv) {
    appDiv.innerHTML = `<div style="padding:20px;color:red;font-family:monospace">
      <h2>App Mount Failed</h2>
      <pre>${err instanceof Error ? err.stack : String(err)}</pre>
    </div>`
  }
}
