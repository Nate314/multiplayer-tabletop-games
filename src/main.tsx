import { StrictMode, Suspense, lazy } from 'react'
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

// Pages outside the app, loaded only when opened so they add nothing to the main bundle; the dev pages are hidden
const StatsPage = lazy(() => import('./stats/StatsPage.tsx'))
const PAGES: Record<string, ReturnType<typeof lazy>> = {
  '/dev/svgs': lazy(() => import('./dev/SvgGallery.tsx')),
  '/dev/sounds': lazy(() => import('./dev/SoundGallery.tsx')),
  '/stats': StatsPage,
}
const { pathname } = window.location
const Page = PAGES[pathname] ?? (pathname.startsWith('/link/') ? StatsPage : undefined)

// index.html always contains the #root element
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {Page ? <Suspense fallback={null}><Page /></Suspense> : <App />}
  </StrictMode>,
)
