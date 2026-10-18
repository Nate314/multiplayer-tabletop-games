import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const scrabble: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'scrabble',
    name: 'Scrabble',
    description: 'Build crossing words from your letter tiles on the premium-square board',
    minPlayers: 2,
    maxPlayers: 4
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState
};
