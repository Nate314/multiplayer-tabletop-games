import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyAction, applyMove, createGameState, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const connectfour: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'connectfour',
    name: 'Connect Four',
    description: 'Drop discs into the grid and line up four in a row',
    minPlayers: 2,
    maxPlayers: 2
  },
  createGameState,
  resetLobby,
  applyMove,
  applyAction,
  toPublicState
};
