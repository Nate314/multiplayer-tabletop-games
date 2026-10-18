import { readJson, writeJson } from './storage.ts'

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
