import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const carcassonne: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'carcassonne',
    category: 'tile',
    name: 'Carcassonne',
    description: 'Lay land tiles to build cities, roads and fields, and claim them with your meeples',
    minPlayers: 2,
    maxPlayers: 5
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  onUndo: (state, random) => ({ ...state, drawPile: shuffle(state.drawPile, random) }),
  toPublicState
};
