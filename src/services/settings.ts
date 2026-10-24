import { readJson, writeJson } from './storage.ts'
import { CATEGORIES } from '../../shared/categories.ts'
import { DEFAULT_FILTERS, parsePlayers } from '../components/gameFilters.ts'
import type { LandingFilters } from '../components/gameFilters.ts'

export type JoinForm = { playerName: string; gameId: string }

const ANIMATIONS_KEY = 'historyAnimations'
const JOIN_FORM_KEY = 'joinForm'

const local = () => localStorage

export function loadAnimations(): boolean {
  return readJson(local, ANIMATIONS_KEY) === true
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
