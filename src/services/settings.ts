import { readJson, writeJson } from './storage.ts'

export type JoinForm = { playerName: string; gameId: string }

export type SoundName = 'turn' | 'move' | 'dice' | 'gameOver' | 'timer'
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
