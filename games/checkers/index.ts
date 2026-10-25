import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyAction, applyMove, createGameState, resetLobby, toPublicState } from './rules.ts';
import { checkersInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const checkers: GameDefinition<GameState, PublicGameState> = {
  info: checkersInfo,
  createGameState,
  resetLobby,
  applyMove,
  applyAction,
  toPublicState
};
