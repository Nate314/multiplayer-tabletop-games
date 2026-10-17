// The most recent game this browser joined, so a refresh can rejoin it and the list can offer it again
export type Session = { gameType: string; gameId: string; playerName: string; inGame: boolean };

const STORAGE_KEY = 'lastGame';

// Storage can be blocked or full (private windows, site settings), so every access is allowed to fail
export function loadSession(): Session | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Session> | null;
    if (
      typeof saved?.gameType !== 'string' ||
      typeof saved.gameId !== 'string' ||
      typeof saved.playerName !== 'string' ||
      typeof saved.inGame !== 'boolean'
    ) {
      return null;
    }
    return { gameType: saved.gameType, gameId: saved.gameId, playerName: saved.playerName, inGame: saved.inGame };
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Without storage the session still lives in memory until the page goes away
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was saved if storage is unavailable
  }
}
