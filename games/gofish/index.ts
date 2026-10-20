import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const gofish: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'gofish',
    category: 'card',
    name: 'Go Fish',
    description: 'Ask for ranks, go fish, and collect the most books of four',
    minPlayers: 2,
    maxPlayers: 6
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  onUndo: (state, random) => ({ ...state, stock: shuffle(state.stock, random) }),
  toPublicState
};
