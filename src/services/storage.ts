// Storage can be blocked or full (private windows, site settings), so every access is allowed to fail
export function readJson(storage: () => Storage, key: string): unknown {
  try {
    return JSON.parse(storage().getItem(key) ?? 'null')
  } catch {
    return null
  }
}

export function writeJson(storage: () => Storage, key: string, value: unknown): void {
  try {
    storage().setItem(key, JSON.stringify(value))
  } catch {
    // Without storage the value only lives until the page goes away
  }
}

export function removeKey(storage: () => Storage, key: string): void {
  try {
    storage().removeItem(key)
  } catch {
    // Nothing was saved if storage is unavailable
  }
}
