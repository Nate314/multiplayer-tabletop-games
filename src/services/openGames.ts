import type { OpenGame } from '../../shared/types.ts';

export const OPEN_GAMES_REFRESH_MS = 5000;

const isOpenGame = (game: unknown): game is OpenGame => {
  const g = game as Partial<OpenGame> | null;
  return typeof g?.gameType === 'string' && typeof g.gameId === 'string' && typeof g.playing === 'boolean'
    && Array.isArray(g.players) && g.players.every(name => typeof name === 'string');
};

export const fetchOpenGames = async (): Promise<OpenGame[] | 'off' | 'failed'> => {
  try {
    const response = await fetch('/api/open-games');
    if (response.status === 404) return 'off';
    if (!response.ok) return 'failed';
    const body = await response.json();
    return Array.isArray(body?.games) ? body.games.filter(isOpenGame) : 'failed';
  } catch {
    return 'failed';
  }
};

export const describeOpenGame = (game: OpenGame, gameName: string): string =>
  `${game.players.join(', ')} ${game.playing ? `currently playing ${gameName}` : 'in the lobby'}`;

// A game in progress can only be watched
export const joinRoleFor = (game: OpenGame): 'player' | 'spectator' => (game.playing ? 'spectator' : 'player');
