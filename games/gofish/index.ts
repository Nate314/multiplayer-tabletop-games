import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const gofish: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'gofish',
    name: 'Go Fish',
    description: 'Ask for ranks, go fish, and collect the most books of four',
    minPlayers: 2,
    maxPlayers: 6
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState
};
