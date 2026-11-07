import { readJson, writeJson } from './storage.ts'

// Where the page and the server live. Served by the game server both are this origin at "/"; on a static host such
// as GitHub Pages the page sits under a sub-path (Vite's --base) and the server is set in Settings.

const BACKEND_KEY = 'backendUrl'
const local = () => localStorage

// '' under node (unit tests), where Vite does not fill in import.meta.env
const env = (import.meta.env ?? {}) as Partial<ImportMetaEnv>
const BASE = (env.BASE_URL ?? '/').replace(/\/$/, '')

// The server's origin as typed, without a trailing slash; '' means the page's own origin
export function loadBackendUrl(): string {
  const saved = readJson(local, BACKEND_KEY)
  return typeof saved === 'string' ? saved : (env.VITE_BACKEND_URL ?? '')
}

// Refuses anything but an http(s) origin, so a typo never sends requests somewhere odd
export function saveBackendUrl(input: string): boolean {
  const text = input.trim()
  if (text === '') {
    writeJson(local, BACKEND_KEY, '')
    return true
  }
  try {
    const url = new URL(text)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    writeJson(local, BACKEND_KEY, url.origin + url.pathname.replace(/\/$/, ''))
    return true
  } catch {
    return false
  }
}

export const apiUrl = (path: string): string => loadBackendUrl() + path

export function socketUrl(): string {
  const backend = loadBackendUrl()
  if (backend) return backend.replace(/^http/, 'ws')
  return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
}

// A path inside the app ("/stats") as a link on this host, and back
export const appPath = (path: string): string => BASE + path
export const routePath = (pathname: string): string =>
  (pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname) || '/'
export const appOrigin = (): string => window.location.origin + BASE
