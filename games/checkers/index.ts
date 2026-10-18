import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyAction, applyMove, createGameState, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const checkers: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'checkers',
    name: 'Checkers',
    description: 'Jump diagonally to capture, and crown a king on the far row',
    minPlayers: 2,
    maxPlayers: 2
  },
  createGameState,
  resetLobby,
  applyMove,
  applyAction,
  toPublicState
};
