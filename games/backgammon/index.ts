import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const backgammon: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'backgammon',
    name: 'Backgammon',
    description: 'Race your fifteen checkers home and bear them off before your opponent',
    minPlayers: 2,
    maxPlayers: 2
  },
  createGameState,
  resetLobby,
  applyMove,
  toPublicState
};
