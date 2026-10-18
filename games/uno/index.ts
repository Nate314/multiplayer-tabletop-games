import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const uno: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'uno',
    name: 'UNO',
    description: 'Match colors and numbers and be the first to empty your hand',
    minPlayers: 2,
    maxPlayers: 8
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState
};
