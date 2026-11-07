import type { GameDefinition } from '../../shared/gameDefinition.ts';
import {
  allowsUndoVote, applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft,
  privateSeatView, recordsAction, resetLobby, toPublicState, waitingOn
} from './rules.ts';
import { tradingfloorInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const tradingfloor: GameDefinition<GameState, PublicGameState> = {
  info: tradingfloorInfo,
  createGameState,
  resetLobby,
  applyMove,
  applyAction,
  recordsAction,
  allowsUndoVote,
  onPlayerLeft,
  onPlayerDisconnected,
  waitingOn,
  finalStandings,
  toPublicState,
  privateSeatView
};
