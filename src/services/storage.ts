// Other apps on the same domain share this origin's storage, so every key carries the repository name
export const STORAGE_PREFIX = 'multiplayer-tabletop-games:'

const MIGRATED_KEY = `${STORAGE_PREFIX}migrated`

// Keys saved without the prefix by earlier versions; a test keeps this in step with the keys the app uses
export const APP_KEYS = [
  'historyAnimations', 'historySpeed', 'historySounds', 'preferences', 'joinForm', 'landingFilters',
  'recentReactions', 'tableLayout', 'lastGame', 'inGame', 'deviceId', 'theme',
]

// Copies old unprefixed values once per storage and never touches them, so an older build still finds its data
function migrate(store: Storage): boolean {
  try {
    if (store.getItem(MIGRATED_KEY) !== null) return true
    for (const key of APP_KEYS) {
      const old = store.getItem(key)
      if (old !== null && store.getItem(STORAGE_PREFIX + key) === null) store.setItem(STORAGE_PREFIX + key, old)
    }
    store.setItem(MIGRATED_KEY, '1')
    return true
  } catch {
    return false
  }
}

// Storage can be blocked or full (private windows, site settings), so every access is allowed to fail
export function readText(storage: () => Storage, key: string): string | null {
  try {
    const store = storage()
    const migrated = migrate(store)
    // If the copy could not be saved, the old value is still the user's data
    return store.getItem(STORAGE_PREFIX + key) ?? (migrated ? null : store.getItem(key))
  } catch {
    return null
  }
}

export function writeText(storage: () => Storage, key: string, value: string): void {
  try {
    const store = storage()
    migrate(store)
    store.setItem(STORAGE_PREFIX + key, value)
  } catch {
    // Without storage the value only lives until the page goes away
  }
}

export function readJson(storage: () => Storage, key: string): unknown {
  try {
    return JSON.parse(readText(storage, key) ?? 'null')
  } catch {
    return null
  }
}

export function writeJson(storage: () => Storage, key: string, value: unknown): void {
  writeText(storage, key, JSON.stringify(value))
}

export function removeKey(storage: () => Storage, key: string): void {
  try {
    const store = storage()
    migrate(store)
    store.removeItem(STORAGE_PREFIX + key)
  } catch {
    // Nothing was saved if storage is unavailable
  }
}
