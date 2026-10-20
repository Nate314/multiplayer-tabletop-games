import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const parchisi: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'parchisi',
    category: 'classic',
    name: 'Parchisi',
    description: 'Roll two dice and race your four pawns around the cross to home',
    minPlayers: 2,
    maxPlayers: 4
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState
};
