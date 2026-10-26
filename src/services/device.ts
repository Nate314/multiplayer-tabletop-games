import { readJson, writeJson } from './storage.ts'

const DEVICE_KEY = 'deviceId'

const local = () => localStorage

// Kept per accessor so blocked storage still gives one ID for the page
const inMemory = new WeakMap<() => Storage, string>()

const isDeviceId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{32}$/.test(value)

// getRandomValues works on plain http, randomUUID does not
function create(storage: () => Storage): string {
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
  inMemory.set(storage, id)
  writeJson(storage, DEVICE_KEY, id)
  return id
}

export function deviceId(storage: () => Storage = local): string {
  const saved = readJson(storage, DEVICE_KEY)
  return isDeviceId(saved) ? saved : (inMemory.get(storage) ?? create(storage))
}

export const replaceDeviceId = (storage: () => Storage = local): string => create(storage)
