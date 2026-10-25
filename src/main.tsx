import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.scss'
import App from './App.tsx'
import { installAudioUnlock, loadSounds } from './sound/synth.ts'

// Lets the built site install as an app (public/sw.js); left out of dev so Vite's hot reload is never cached
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Without it the site still works; it just cannot be installed or opened offline
  })
}

installAudioUnlock(window)
void loadSounds()

// index.html always contains the #root element
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
