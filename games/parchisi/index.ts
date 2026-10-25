import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { parchisiInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const parchisi: GameDefinition<GameState, PublicGameState> = {
  info: parchisiInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState
};
