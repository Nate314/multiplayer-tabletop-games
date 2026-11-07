import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { adoptServerParam, apiUrl, loadBackendUrl, routePath, saveBackendUrl, withServer } from './urls.ts'

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

test('a shared link carries the server only when one is set', () => {
  assert.equal(withServer('https://site/join/chess/a'), 'https://site/join/chess/a')
  saveBackendUrl('https://games.example.com')
  assert.equal(withServer('https://site/join/chess/a'), 'https://site/join/chess/a?server=https%3A%2F%2Fgames.example.com')
})

// A stand-in for the page at `href`, recording where replaceState leaves the address bar
function openPage(href: string) {
  const page = { href }
  globalThis.window = {
    location: page,
    history: { replaceState: (_s: unknown, _t: string, url: URL) => { page.href = String(url) } },
  } as unknown as Window & typeof globalThis
  return page
}

test('?server= is saved and removed from the address, keeping the rest', () => {
  const page = openPage('https://site/join/chess/a?server=https%3A%2F%2Fgames.example.com&game=x')
  adoptServerParam()
  assert.equal(loadBackendUrl(), 'https://games.example.com')
  assert.equal(page.href, 'https://site/join/chess/a?game=x')
})

test('an invalid ?server= keeps the saved server', () => {
  saveBackendUrl('https://games.example.com')
  openPage('https://site/?server=javascript%3Aalert(1)')
  adoptServerParam()
  assert.equal(loadBackendUrl(), 'https://games.example.com')
})
