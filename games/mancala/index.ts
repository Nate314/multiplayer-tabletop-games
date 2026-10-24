import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { MANCALA_RULES, applyMove, createGameState, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const mancala: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'mancala',
    category: 'classic',
    name: 'Mancala',
    description: 'Drop stones around the board, play Avalanche or Kalah, and fill your bank',
    minPlayers: 2,
    maxPlayers: 2,
    houseRules: MANCALA_RULES
  },
  createGameState,
  resetLobby,
  applyMove,
  toPublicState
};
