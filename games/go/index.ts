import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyAction, applyMove, createGameState, finalStandings, recordsAction, resetLobby, toPublicState, waitingOn } from './rules.ts';
import { goInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const go: GameDefinition<GameState, PublicGameState> = {
  info: goInfo,
  createGameState,
  resetLobby,
  applyMove,
  applyAction,
  recordsAction,
  waitingOn,
  finalStandings,
  toPublicState
};
