import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { farkleInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const farkle: GameDefinition<GameState, PublicGameState> = {
  info: farkleInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState
};
