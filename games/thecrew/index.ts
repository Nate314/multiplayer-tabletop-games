import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyAction, applyMove, createGameState, onPlayerDisconnected, onPlayerLeft, onUndo, resetLobby, toPublicState } from './rules.ts';
import { thecrewInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const thecrew: GameDefinition<GameState, PublicGameState> = {
  info: thecrewInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  onUndo,
  applyMove,
  applyAction,
  toPublicState
};
