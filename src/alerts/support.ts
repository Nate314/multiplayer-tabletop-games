import { getPreferences } from '../hooks/usePreferences.ts'

export type AlertSupport = 'ready' | 'insecure' | 'unsupported' | 'iphoneHomeScreen' | 'blocked'
type AlertEnv = { isSecureContext: boolean; hasNotification: boolean; permission?: NotificationPermission; userAgent: string; maxTouchPoints: number; standalone: boolean }

export const SUPPORT_EXPLANATIONS: Record<Exclude<AlertSupport, 'ready'>, string> = {
  insecure: 'Notifications need a secure (https) address. The tab title still shows when it is your turn.',
  iphoneHomeScreen: 'On iPhone, add this site to your Home Screen (Share, then Add to Home Screen) and open it from there to get notifications.',
  unsupported: 'This browser cannot show notifications. The tab title still shows when it is your turn.',
  blocked: "Notifications are blocked for this site in the browser's settings.",
}

// Tells a mounted game a fresh permission came in, so it can subscribe its seats
export const ALERTS_GRANTED = 'alerts-granted'

export function alertSupport(env: AlertEnv): AlertSupport {
  if (!env.isSecureContext) return 'insecure'
  // iPadOS reports itself as a Mac, but a Mac has no touch screen
  const apple = /iPhone|iPad|iPod/.test(env.userAgent) || (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1)
  if (apple && !env.standalone) return 'iphoneHomeScreen'
  if (!env.hasNotification) return 'unsupported'
  return env.permission === 'denied' ? 'blocked' : 'ready'
}

export function currentEnv(): AlertEnv {
  try {
    const hasNotification = 'Notification' in window
    return {
      isSecureContext: window.isSecureContext,
      hasNotification,
      permission: hasNotification ? Notification.permission : undefined,
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints ?? 0,
      standalone: window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true,
    }
  } catch {
    return { isSecureContext: false, hasNotification: false, userAgent: '', maxTouchPoints: 0, standalone: false }
  }
}

// Called straight from a click: browsers only show the prompt during a user gesture, so nothing is awaited first
export function requestAlerts(): void {
  try {
    const env = currentEnv()
    if (!getPreferences().notifications || alertSupport(env) !== 'ready' || env.permission !== 'default') return
    Notification.requestPermission()
      .then(permission => { if (permission === 'granted') window.dispatchEvent(new Event(ALERTS_GRANTED)) })
      .catch(() => {})
  } catch {
    // an old callback-only requestPermission or a missing API leaves the tab title only
  }
}

const keyBytes = (base64url: string) => Uint8Array.from(atob(base64url.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))

export function sameKey(existing: ArrayBuffer | null, key: Uint8Array): boolean {
  if (!existing || existing.byteLength !== key.length) return false
  const bytes = new Uint8Array(existing)
  return key.every((byte, i) => byte === bytes[i])
}

// serviceWorker.ready never settles without a registered worker (as in dev), which simply means no push
export async function subscribePush(): Promise<string | null> {
  try {
    const registration = await navigator.serviceWorker.ready
    const { publicKey } = await (await fetch('/api/push/key')).json() as { publicKey: string }
    const serverKey = keyBytes(publicKey)
    const existing = await registration.pushManager.getSubscription()
    // A subscription bound to older server keys (after a database reset) only gets 403s
    if (existing && sameKey(existing.options?.applicationServerKey ?? null, serverKey)) return existing.endpoint
    await existing?.unsubscribe()
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey })
    return subscription.endpoint
  } catch {
    return null
  }
}

export function unsubscribePush(): void {
  try {
    navigator.serviceWorker.getRegistration()
      .then(registration => registration?.pushManager.getSubscription())
      .then(subscription => subscription?.unsubscribe())
      .catch(() => {})
  } catch {
    // no service worker, so no subscription to drop
  }
}

// Through the worker when there is one, since Android refuses new Notification; same tag as a push, so a double shows once
export function showAlert(title: string, body: string, tag: string): void {
  const options = { body, tag, icon: '/icon-192.png', badge: '/icon-192.png', data: { url: window.location.href, tag } }
  try {
    Promise.resolve(navigator.serviceWorker?.getRegistration())
      .then(registration => {
        if (registration?.active) return registration.showNotification(title, options)
        new Notification(title, options).onclick = () => window.focus()
      })
      .catch(() => {})
  } catch {
    // an alert is a nicety; the tab title still shows it
  }
}
