import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { whodunitInfo } from './info.ts';
import { allowsOutOfTurn, applyAction, applyMove, createGameState, resetLobby, toPublicState, waitingOn } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const whodunit: GameDefinition<GameState, PublicGameState> = {
  info: whodunitInfo,
  createGameState,
  resetLobby,
  applyMove,
  allowsOutOfTurn,
  applyAction,
  waitingOn,
  toPublicState
};
