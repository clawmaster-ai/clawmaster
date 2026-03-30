import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Restore persisted theme preferences before first paint
;(() => {
  const root = document.documentElement
  // Dark mode
  const mode = localStorage.getItem('clawmaster-theme') || 'system'
  if (mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    root.classList.add('dark')
  }
  // Color theme
  const colorTheme = localStorage.getItem('clawmaster-color-theme')
  if (colorTheme) root.classList.add(colorTheme)
})()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
