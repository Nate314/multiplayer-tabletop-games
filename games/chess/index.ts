import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyAction, applyMove, createGameState, deadline, onDeadline, resetLobby, resumeClock, toPublicState } from './rules.ts';
import { chessInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const chess: GameDefinition<GameState, PublicGameState> = {
  info: chessInfo,
  createGameState,
  resetLobby,
  applyMove,
  applyAction,
  deadline,
  onDeadline,
  resumeClock,
  toPublicState
};
