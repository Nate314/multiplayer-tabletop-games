import { useSyncExternalStore } from 'react'
import { loadPreferences, savePreferences, type Preferences } from '../services/settings.ts'

let current: Preferences | null = null
const listeners = new Set<() => void>()

export function getPreferences(): Preferences {
  current ??= loadPreferences()
  return current
}

export function setPreferences(next: Preferences): void {
  current = next
  savePreferences(next)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export default function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, getPreferences)
}
