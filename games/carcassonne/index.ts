import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { carcassonneInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const carcassonne: GameDefinition<GameState, PublicGameState> = {
  info: carcassonneInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  onUndo: (state, random) => ({ ...state, drawPile: shuffle(state.drawPile, random) }),
  toPublicState
};
