import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const mancala: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'mancala',
    category: 'classic',
    name: 'Mancala',
    description: 'Drop stones around the board, keep going from every full pit, and fill your bank',
    minPlayers: 2,
    maxPlayers: 2
  },
  createGameState,
  resetLobby,
  applyMove,
  toPublicState
};
