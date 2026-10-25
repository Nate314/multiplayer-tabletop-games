import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { DEFAULT_FILTERS } from '../components/gameFilters.ts'
import {
  DEFAULT_PREFERENCES, loadAnimations, loadHistorySounds, loadJoinForm, loadLandingFilters, loadPlaybackSpeed, loadPreferences,
  saveAnimations, saveHistorySounds, saveJoinForm, saveLandingFilters, savePlaybackSpeed, savePreferences,
} from './settings.ts'

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

test('playback speed defaults to 1x and round-trips', () => {
  installStorage()
  assert.equal(loadPlaybackSpeed(), 1)
  savePlaybackSpeed(4)
  assert.equal(loadPlaybackSpeed(), 4)
})

test('an unknown playback speed falls back to 1x', () => {
  installStorage({ historySpeed: '3' })
  assert.equal(loadPlaybackSpeed(), 1)
  installStorage({ historySpeed: '"2"' })
  assert.equal(loadPlaybackSpeed(), 1)
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
  assert.deepEqual(loadLandingFilters(), DEFAULT_FILTERS)
  assert.equal(loadPlaybackSpeed(), 1)
  assert.deepEqual(loadPreferences(), DEFAULT_PREFERENCES)
  saveAnimations(true)
  savePlaybackSpeed(2)
  saveJoinForm({ playerName: 'Ann', gameId: 'abc' })
  saveLandingFilters(DEFAULT_FILTERS)
  savePreferences(DEFAULT_PREFERENCES)
  saveHistorySounds(true)
})

test('preferences default to every sound on at half volume, symbols off and the highlight on', () => {
  installStorage()
  assert.deepEqual(loadPreferences(), {
    volume: 0.5, muted: false,
    sounds: { turn: true, move: true, dice: true, gameOver: true, timer: true },
    colorSymbols: false, highlightDrawn: true,
  })
})

test('preferences round-trip', () => {
  installStorage()
  const changed = { ...DEFAULT_PREFERENCES, volume: 0.2, muted: true, colorSymbols: true, highlightDrawn: false,
    sounds: { ...DEFAULT_PREFERENCES.sounds, dice: false } }
  savePreferences(changed)
  assert.deepEqual(loadPreferences(), changed)
})

test('each bad preference falls back to its own default and the good ones are kept', () => {
  installStorage({ preferences: '{"volume":"loud","muted":true,"sounds":{"dice":false,"turn":"no"},"colorSymbols":1}' })
  assert.deepEqual(loadPreferences(), { ...DEFAULT_PREFERENCES, muted: true, sounds: { ...DEFAULT_PREFERENCES.sounds, dice: false } })
  for (const volume of ['2', '-1', 'null']) {
    installStorage({ preferences: `{"volume":${volume}}` })
    assert.equal(loadPreferences().volume, 0.5)
  }
  installStorage({ preferences: '[1]' })
  assert.deepEqual(loadPreferences(), DEFAULT_PREFERENCES)
})

test('history sounds default to off and round-trip', () => {
  installStorage()
  assert.equal(loadHistorySounds(), false)
  saveHistorySounds(true)
  assert.equal(loadHistorySounds(), true)
})

test('landing filters default to everything shown and round-trip', () => {
  installStorage()
  assert.deepEqual(loadLandingFilters(), DEFAULT_FILTERS)
  const filters = { search: 'uno', sort: 'name' as const, categories: ['card' as const, 'dice' as const], players: 4 }
  saveLandingFilters(filters)
  assert.deepEqual(loadLandingFilters(), filters)
})

test('junk landing filters fall back field by field', () => {
  installStorage({ landingFilters: '{"search":5,"sort":"x","categories":["dice","nope"],"players":2.5}' })
  assert.deepEqual(loadLandingFilters(), { search: '', sort: 'category', categories: ['dice'], players: null })
})
