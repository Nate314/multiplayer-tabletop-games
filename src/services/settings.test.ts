import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { loadAnimations, loadJoinForm, saveAnimations, saveJoinForm } from './settings.ts'

function installStorage(initial: Record<string, string> = {}): void {
  const items = new Map(Object.entries(initial))
  const fake = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true })
}

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage
})

test('animations default to off and round-trip', () => {
  installStorage()
  assert.equal(loadAnimations(), false)
  saveAnimations(true)
  assert.equal(loadAnimations(), true)
  saveAnimations(false)
  assert.equal(loadAnimations(), false)
})

test('join form defaults to empty and round-trips', () => {
  installStorage()
  assert.deepEqual(loadJoinForm(), { playerName: '', gameId: '' })
  saveJoinForm({ playerName: 'Ann', gameId: 'abc' })
  assert.deepEqual(loadJoinForm(), { playerName: 'Ann', gameId: 'abc' })
})

test('junk in storage falls back to defaults', () => {
  installStorage({ historyAnimations: '"yes"', joinForm: '[1]' })
  assert.equal(loadAnimations(), false)
  assert.deepEqual(loadJoinForm(), { playerName: '', gameId: '' })
  installStorage({ joinForm: '{"playerName":5}' })
  assert.deepEqual(loadJoinForm(), { playerName: '', gameId: '' })
})

test('a storage that throws gives defaults and saving does not throw', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    get() {
      throw new Error('blocked')
    },
    configurable: true,
  })
  assert.equal(loadAnimations(), false)
  assert.deepEqual(loadJoinForm(), { playerName: '', gameId: '' })
  saveAnimations(true)
  saveJoinForm({ playerName: 'Ann', gameId: 'abc' })
})
