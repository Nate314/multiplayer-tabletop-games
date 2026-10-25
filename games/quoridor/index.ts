import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { quoridorInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const quoridor: GameDefinition<GameState, PublicGameState> = {
  info: quoridorInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState
};
