import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const quoridor: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'quoridor',
    category: 'classic',
    name: 'Quoridor',
    description: 'Race your pawn to the far side and block opponents with walls',
    minPlayers: 2,
    maxPlayers: 4
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState
};
