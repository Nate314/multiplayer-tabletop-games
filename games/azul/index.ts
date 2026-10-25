import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { applyAction, applyMove, createGameState, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { azulInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const azul: GameDefinition<GameState, PublicGameState> = {
  info: azulInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  onUndo: (state, random) => ({ ...state, bag: shuffle(state.bag, random) }),
  toPublicState
};
