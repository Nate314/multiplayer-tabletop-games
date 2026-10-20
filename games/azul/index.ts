import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { applyAction, applyMove, createGameState, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const azul: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'azul',
    category: 'tile',
    name: 'Azul',
    description: 'Draft colored tiles and decorate your palace wall',
    minPlayers: 2,
    maxPlayers: 4
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  onUndo: (state, random) => ({ ...state, bag: shuffle(state.bag, random) }),
  toPublicState
};
