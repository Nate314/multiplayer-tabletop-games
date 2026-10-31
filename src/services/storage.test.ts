import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { APP_KEYS, STORAGE_PREFIX, readJson, readText, removeKey, writeJson, writeText } from './storage.ts'

const P = 'multiplayer-tabletop-games:'

function stubStorage(initial: Record<string, string> = {}, setFails = false) {
  const items = new Map(Object.entries(initial))
  const sets: string[] = []
  const storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (setFails) throw new Error('full')
      sets.push(key)
      items.set(key, value)
    },
    removeItem: (key: string) => void items.delete(key),
  } as unknown as Storage
  return { storage: () => storage, items, sets }
}

test('a write is stored under the prefixed key', () => {
  const { storage, items } = stubStorage({ [`${P}migrated`]: '1' })
  writeJson(storage, 'preferences', { muted: true })
  assert.equal(items.get(`${P}preferences`), '{"muted":true}')
  assert.equal(items.has('preferences'), false)
})

test('a read uses the prefixed key', () => {
  const { storage } = stubStorage({ [`${P}historySpeed`]: '2' })
  assert.equal(readJson(storage, 'historySpeed'), 2)
})

test('a bare key is copied to the prefixed key once', () => {
  const id = 'a'.repeat(32)
  const { storage, items, sets } = stubStorage({ deviceId: JSON.stringify(id) })
  assert.equal(readJson(storage, 'deviceId'), id)
  assert.equal(items.get(`${P}deviceId`), JSON.stringify(id))
  assert.equal(items.get('deviceId'), JSON.stringify(id))
  const count = sets.length
  assert.equal(readJson(storage, 'deviceId'), id)
  assert.equal(sets.length, count)
})

test('both present: prefixed wins, bare left alone', () => {
  const { storage, items } = stubStorage({ theme: 'light', [`${P}theme`]: 'dark' })
  assert.equal(readText(storage, 'theme'), 'dark')
  assert.equal(items.get('theme'), 'light')
})

test('copy cannot be written: old value returned and kept', () => {
  const { storage, items } = stubStorage({ joinForm: '{"playerName":"Ann"}' }, true)
  assert.deepEqual(readJson(storage, 'joinForm'), { playerName: 'Ann' })
  assert.equal(items.get('joinForm'), '{"playerName":"Ann"}')
})

test('removeKey removes only the prefixed key and a removed key is not resurrected', () => {
  const { storage, items } = stubStorage({ inGame: '{}' })
  assert.equal(readText(storage, 'inGame'), '{}')
  removeKey(storage, 'inGame')
  assert.equal(items.has(`${P}inGame`), false)
  assert.equal(items.get('inGame'), '{}')
  assert.equal(readText(storage, 'inGame'), null)
})

test('after the marker bare keys are not read', () => {
  const { storage } = stubStorage({ [`${P}migrated`]: '1', theme: 'light' })
  assert.equal(readText(storage, 'theme'), null)
})

test('readText and writeText keep a raw string', () => {
  const { storage, items } = stubStorage()
  writeText(storage, 'theme', 'dark')
  assert.equal(items.get(`${P}theme`), 'dark')
  assert.equal(readText(storage, 'theme'), 'dark')
})

test('blocked storage reads null and writes do not throw', () => {
  const blocked = (() => { throw new Error('blocked') }) as () => Storage
  assert.equal(readText(blocked, 'theme'), null)
  assert.equal(readJson(blocked, 'theme'), null)
  writeText(blocked, 'theme', 'dark')
  writeJson(blocked, 'x', 1)
  removeKey(blocked, 'x')
})

test('every storage key used by the app is in APP_KEYS', () => {
  const files = ['src/services/settings.ts', 'src/services/session.ts', 'src/services/device.ts', 'src/components/ThemeToggle.tsx']
  const found = files.flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/\b[A-Z_]*KEY = '([^']+)'/g)].map((m) => m[1]),
  )
  assert.ok(found.length >= 10)
  for (const key of found) assert.ok(APP_KEYS.includes(key), `${key} is missing from APP_KEYS`)
})

test('the inline theme script in index.html reads the prefixed theme and migration keys', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
  assert.ok(html.includes(`'${STORAGE_PREFIX}theme'`))
  assert.ok(html.includes(`'${STORAGE_PREFIX}migrated'`))
})
