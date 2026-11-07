import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { apiUrl, loadBackendUrl, routePath, saveBackendUrl } from './urls.ts'

const store = new Map<string, string>()
globalThis.localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value) },
} as Storage

beforeEach(() => store.clear())

test('with no server set the API is this origin', () => {
  assert.equal(loadBackendUrl(), '')
  assert.equal(apiUrl('/api/sound'), '/api/sound')
})

test('a saved server prefixes every API path, without a trailing slash', () => {
  assert.equal(saveBackendUrl(' https://games.example.com/ '), true)
  assert.equal(apiUrl('/api/sound'), 'https://games.example.com/api/sound')
})

test('anything but an http(s) address is refused and keeps the old one', () => {
  saveBackendUrl('https://games.example.com')
  assert.equal(saveBackendUrl('games.example.com'), false)
  assert.equal(saveBackendUrl('javascript:alert(1)'), false)
  assert.equal(loadBackendUrl(), 'https://games.example.com')
})

test('an empty address goes back to this origin', () => {
  saveBackendUrl('https://games.example.com')
  saveBackendUrl('')
  assert.equal(apiUrl('/api/sound'), '/api/sound')
})

test('routes are read the same at the root', () => {
  assert.equal(routePath('/stats'), '/stats')
  assert.equal(routePath('/'), '/')
})
