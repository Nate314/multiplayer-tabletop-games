import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const rummikub: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'rummikub',
    category: 'tile',
    name: 'Rummikub',
    description: 'Lay down sets and runs of numbered tiles and rearrange the table to empty your rack',
    minPlayers: 2,
    maxPlayers: 4
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  onUndo: (state, random) => ({ ...state, pool: shuffle(state.pool, random) }),
  toPublicState
};
