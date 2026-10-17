// The most recent game this tab joined, so a refresh can rejoin it and the list can offer it again
export type Session = { gameType: string; gameId: string; playerName: string; inGame: boolean };

type SavedGame = Omit<Session, 'inGame'>;

// Shared by every tab: the game the "Back to ..." button offers
const LAST_GAME_KEY = 'lastGame';
// This tab only, and kept across a refresh: the game to take back automatically.
// Per tab so a second tab, or a tab seated as another player, never rejoins as someone else.
const IN_GAME_KEY = 'inGame';

// Storage can be blocked or full (private windows, site settings), so every access is allowed to fail
function read(storage: () => Storage, key: string): SavedGame | null {
  try {
    const saved = JSON.parse(storage().getItem(key) ?? 'null') as Partial<SavedGame> | null;
    if (typeof saved?.gameType !== 'string' || typeof saved.gameId !== 'string' || typeof saved.playerName !== 'string') {
      return null;
    }
    return { gameType: saved.gameType, gameId: saved.gameId, playerName: saved.playerName };
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, game: SavedGame): void {
  try {
    storage().setItem(key, JSON.stringify(game));
  } catch {
    // Without storage the session still lives in memory until the page goes away
  }
}

function remove(storage: () => Storage, key: string): void {
  try {
    storage().removeItem(key);
  } catch {
    // Nothing was saved if storage is unavailable
  }
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
  write(local, LAST_GAME_KEY, game);
  if (inGame) {
    write(perTab, IN_GAME_KEY, game);
  } else {
    remove(perTab, IN_GAME_KEY);
  }
}

// Forgets this game; another tab's newer game stays offered
export function clearSession(game: SavedGame): void {
  remove(perTab, IN_GAME_KEY);
  const lastGame = read(local, LAST_GAME_KEY);
  if (lastGame && sameGame(lastGame, game)) remove(local, LAST_GAME_KEY);
}
