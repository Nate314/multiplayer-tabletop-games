import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const mancala: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'mancala',
    name: 'Mancala',
    description: 'Sow seeds around the board and capture the most in your store',
    minPlayers: 2,
    maxPlayers: 2
  },
  createGameState,
  resetLobby,
  applyMove,
  toPublicState
};
