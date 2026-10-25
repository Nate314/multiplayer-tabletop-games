import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffleEach } from '../../shared/shuffle.ts';
import { applyMove, createGameState, resetLobby, toPublicState } from './rules.ts';
import { warInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const war: GameDefinition<GameState, PublicGameState> = {
  info: warInfo,
  createGameState,
  resetLobby,
  applyMove,
  onUndo: (state, random) => ({ ...state, piles: shuffleEach(state.piles, random) }),
  toPublicState
};
