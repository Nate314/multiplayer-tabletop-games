import { readJson, removeKey, writeJson } from './storage.ts'
import type { JoinRole } from '../../shared/types.ts'

// The most recent game this tab joined, so a refresh can rejoin it and the list can offer it again
// `seatKey` is the secret the server gave the seat, which taking it back needs
// `role` is only kept for a spectator or a pass-and-play device, so a refresh rejoins as one; missing means a player
// `localSeats` is every seat of a pass-and-play device with its own key, in seating order
export type LocalSeatKey = { playerName: string; seatKey: string };
export type Session = {
  gameType: string; gameId: string; playerName: string; seatKey?: string; role?: JoinRole; localSeats?: LocalSeatKey[]; inGame: boolean
};

type SavedGame = Omit<Session, 'inGame'>;

// Shared by every tab: the game the "Back to ..." button offers
const LAST_GAME_KEY = 'lastGame';
// This tab only, and kept across a refresh: the game to take back automatically.
// Per tab so a second tab, or a tab seated as another player, never rejoins as someone else.
const IN_GAME_KEY = 'inGame';

const isLocalSeats = (value: unknown): value is LocalSeatKey[] =>
  Array.isArray(value) && value.length > 0 && value.every(item => typeof item?.playerName === 'string' && typeof item.seatKey === 'string')

function read(storage: () => Storage, key: string): SavedGame | null {
  const saved = readJson(storage, key) as Partial<SavedGame> | null
  if (typeof saved?.gameType !== 'string' || typeof saved.gameId !== 'string' || typeof saved.playerName !== 'string') {
    return null
  }
  const seatKey = typeof saved.seatKey === 'string' ? saved.seatKey : undefined
  // A pass-and-play entry without usable seats falls back to a normal session
  const localSeats = saved.role === 'passAndPlay' && isLocalSeats(saved.localSeats) ? saved.localSeats : undefined
  const role = saved.role === 'spectator' ? saved.role : localSeats && 'passAndPlay'
  return { gameType: saved.gameType, gameId: saved.gameId, playerName: saved.playerName, seatKey, role, localSeats }
}

const local = () => localStorage;
const perTab = () => sessionStorage;

function sameGame(a: SavedGame, b: SavedGame): boolean {
  return a.gameType === b.gameType && a.gameId === b.gameId && a.playerName === b.playerName;
}

export function loadSession(): Session | null {
  const inGame = read(perTab, IN_GAME_KEY);
  if (inGame) return { ...inGame, inGame: true };
  const lastGame = read(local, LAST_GAME_KEY);
  return lastGame && { ...lastGame, inGame: false };
}

export function saveSession({ inGame, ...game }: Session): void {
  writeJson(local, LAST_GAME_KEY, game);
  if (inGame) {
    writeJson(perTab, IN_GAME_KEY, game);
  } else {
    removeKey(perTab, IN_GAME_KEY);
  }
}

// Forgets this game; another tab's newer game stays offered
export function clearSession(game: SavedGame): void {
  removeKey(perTab, IN_GAME_KEY);
  const lastGame = read(local, LAST_GAME_KEY);
  if (lastGame && sameGame(lastGame, game)) removeKey(local, LAST_GAME_KEY);
}
