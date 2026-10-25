import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyAction, applyMove, createGameState, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { euchreInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const euchre: GameDefinition<GameState, PublicGameState> = {
  info: euchreInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  toPublicState
};
