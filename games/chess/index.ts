import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyAction, applyMove, createGameState, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const chess: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'chess',
    category: 'classic',
    name: 'Chess',
    description: 'Checkmate the enemy king in the classic two-player strategy game',
    minPlayers: 2,
    maxPlayers: 2
  },
  createGameState,
  resetLobby,
  applyMove,
  applyAction,
  toPublicState
};
