import { readJson, writeJson } from './storage.ts'
import { PLAYBACK_SPEEDS } from '../components/playback.ts'
import type { PlaybackSpeed } from '../components/playback.ts'
import { CATEGORIES } from '../../shared/categories.ts'
import { DEFAULT_FILTERS, parsePlayers } from '../components/gameFilters.ts'
import type { LandingFilters } from '../components/gameFilters.ts'
import type { SoundName } from '../../shared/sounds.ts'

export type JoinForm = { playerName: string; gameId: string }

export type { SoundName }
export type Preferences = {
  volume: number
  muted: boolean
  sounds: Record<SoundName, boolean>
  colorSymbols: boolean
  highlightDrawn: boolean
}

export const DEFAULT_PREFERENCES: Preferences = {
  volume: 0.5,
  muted: false,
  sounds: { turn: true, move: true, dice: true, gameOver: true, timer: true },
  colorSymbols: false,
  highlightDrawn: true,
}

const ANIMATIONS_KEY = 'historyAnimations'
const SPEED_KEY = 'historySpeed'
const HISTORY_SOUNDS_KEY = 'historySounds'
const PREFERENCES_KEY = 'preferences'
const JOIN_FORM_KEY = 'joinForm'

const local = () => localStorage

const readFlag = (key: string): boolean => readJson(local, key) === true

export function loadAnimations(): boolean {
  return readFlag(ANIMATIONS_KEY)
}

export function saveAnimations(on: boolean): void {
  writeJson(local, ANIMATIONS_KEY, on)
}

export function loadPlaybackSpeed(): PlaybackSpeed {
  const saved = readJson(local, SPEED_KEY)
  return PLAYBACK_SPEEDS.find(speed => speed === saved) ?? 1
}

export function savePlaybackSpeed(speed: PlaybackSpeed): void {
  writeJson(local, SPEED_KEY, speed)
}

// One remembered pair, shared by every game
export function loadJoinForm(): JoinForm {
  const saved = readJson(local, JOIN_FORM_KEY) as Partial<JoinForm> | null
  return {
    playerName: typeof saved?.playerName === 'string' ? saved.playerName : '',
    gameId: typeof saved?.gameId === 'string' ? saved.gameId : '',
  }
}

export function saveJoinForm(form: JoinForm): void {
  writeJson(local, JOIN_FORM_KEY, form)
}

const LANDING_FILTERS_KEY = 'landingFilters'

// Each field is checked on its own, so one bad field keeps the rest
export function loadLandingFilters(): LandingFilters {
  const saved = (readJson(local, LANDING_FILTERS_KEY) ?? {}) as Record<string, unknown>
  const players = typeof saved.players === 'number' ? parsePlayers(String(saved.players)) : null
  return {
    search: typeof saved.search === 'string' ? saved.search : DEFAULT_FILTERS.search,
    sort: saved.sort === 'category' || saved.sort === 'name' ? saved.sort : DEFAULT_FILTERS.sort,
    categories: Array.isArray(saved.categories)
      ? CATEGORIES.map(category => category.id).filter(id => (saved.categories as unknown[]).includes(id))
      : DEFAULT_FILTERS.categories,
    players,
  }
}

export function saveLandingFilters(filters: LandingFilters): void {
  writeJson(local, LANDING_FILTERS_KEY, filters)
}

export function loadHistorySounds(): boolean {
  return readFlag(HISTORY_SOUNDS_KEY)
}

export function saveHistorySounds(on: boolean): void {
  writeJson(local, HISTORY_SOUNDS_KEY, on)
}

const flagOr = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback)

// Each field is checked on its own, so one bad value never costs the player the others
export function loadPreferences(): Preferences {
  const saved = readJson(local, PREFERENCES_KEY) as Partial<Record<keyof Preferences, unknown>> | null
  const d = DEFAULT_PREFERENCES
  const sounds = (typeof saved?.sounds === 'object' && saved.sounds ? saved.sounds : {}) as Record<string, unknown>
  const volume = saved?.volume
  return {
    volume: typeof volume === 'number' && volume >= 0 && volume <= 1 ? volume : d.volume,
    muted: flagOr(saved?.muted, d.muted),
    sounds: Object.fromEntries(
      Object.entries(d.sounds).map(([name, on]) => [name, flagOr(sounds[name], on)]),
    ) as Record<SoundName, boolean>,
    colorSymbols: flagOr(saved?.colorSymbols, d.colorSymbols),
    highlightDrawn: flagOr(saved?.highlightDrawn, d.highlightDrawn),
  }
}

export function savePreferences(preferences: Preferences): void {
  writeJson(local, PREFERENCES_KEY, preferences)
}
