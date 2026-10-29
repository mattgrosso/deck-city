import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { setupSentry } from './sentry'
import { flushQueuedBugReports } from './utils/bugReports'
import { installErrorCapture, installConnectionWatch } from './utils/bugContext'
import { db } from './firebase'
import { trackUsage } from './utils/usage.js'

// House kit (see AGENTS.md "House standards"): one anonymous usage ping per
// open, recent errors kept for bug reports, crash reporting in production.
trackUsage('deck-city')
installErrorCapture()
installConnectionWatch(db)

const app = createApp(App)
setupSentry(app)
app.mount('#app')

flushQueuedBugReports()

if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${process.env.BASE_URL}service-worker.js`).catch(() => {})
  })
}
