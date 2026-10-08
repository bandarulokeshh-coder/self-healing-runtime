import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Global error handler for uncaught errors
window.addEventListener('error', (event) => {
  console.log('[Self-Healing Runtime] Uncaught error:', event.error)
})

window.addEventListener('unhandledrejection', (event) => {
  console.log('[Self-Healing Runtime] Unhandled promise rejection:', event.reason)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
