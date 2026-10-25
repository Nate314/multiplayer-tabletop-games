import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { rummikubInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const rummikub: GameDefinition<GameState, PublicGameState> = {
  info: rummikubInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  onUndo: (state, random) => ({ ...state, pool: shuffle(state.pool, random) }),
  toPublicState
};
