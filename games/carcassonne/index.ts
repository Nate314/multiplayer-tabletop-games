import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const carcassonne: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'carcassonne',
    name: 'Carcassonne',
    description: 'Lay land tiles to build cities, roads and fields, and claim them with your meeples',
    minPlayers: 2,
    maxPlayers: 5
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState
};
