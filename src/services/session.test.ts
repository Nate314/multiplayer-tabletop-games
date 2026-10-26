import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { loadSession, saveSession } from './session.ts'

function installStorage(name: 'localStorage' | 'sessionStorage', initial: Record<string, string> = {}): void {
  const items = new Map(Object.entries(initial))
  const fake = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
  Object.defineProperty(globalThis, name, { value: fake, configurable: true })
}

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage
})

const passAndPlay = {
  gameType: 'gofish', gameId: 'abc', playerName: 'Ann', role: 'passAndPlay' as const, inGame: true,
  localSeats: [{ playerName: 'Ann', seatKey: 'k1' }, { playerName: 'Bo', seatKey: 'k2' }],
}

test('a pass-and-play session keeps both seats through save and load', () => {
  installStorage('localStorage')
  installStorage('sessionStorage')
  saveSession(passAndPlay)
  assert.deepEqual(loadSession(), { ...passAndPlay, seatKey: undefined })
})

test('malformed local seats load as a normal session', () => {
  for (const localSeats of ['x', [{ playerName: 1 }], [{ playerName: 'Ann', seatKey: 'k' }, null]]) {
    const saved = JSON.stringify({ gameType: 'gofish', gameId: 'abc', playerName: 'Ann', role: 'passAndPlay', localSeats })
    installStorage('localStorage')
    installStorage('sessionStorage', { inGame: saved })
    const session = loadSession()
    assert.equal(session?.localSeats, undefined)
    assert.equal(session?.role, undefined)
    assert.equal(session?.playerName, 'Ann')
  }
})
