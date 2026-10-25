import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffle } from '../../shared/shuffle.ts';
import {
  allowsOutOfTurn, applyAction, applyMove, createGameState, onPlayerDisconnected, onPlayerLeft, resetLobby,
  toPublicState
} from './rules.ts';
import { catanInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const catan: GameDefinition<GameState, PublicGameState> = {
  info: catanInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  allowsOutOfTurn,
  applyAction,
  onUndo: (state, random) => ({ ...state, devDeck: shuffle(state.devDeck, random) }),
  toPublicState
};
