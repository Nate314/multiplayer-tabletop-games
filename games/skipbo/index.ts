import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const skipbo: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'skipbo',
    name: 'Skip-Bo',
    description: 'Build piles from 1 to 12 and be first to empty your stock pile',
    minPlayers: 2,
    maxPlayers: 6
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState
};
