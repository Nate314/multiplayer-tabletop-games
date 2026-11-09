import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import {
  allowsUndoVote, applyAction, applyMove, createGameState, deadline, finalStandings, onDeadline, onPlayerDisconnected, onPlayerLeft,
  privateSeatView, recordsAction, resetLobby, resumeClock, toPublicState, waitingOn
} from './rules.ts';
import { categoriesInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const categories: GameDefinition<GameState, PublicGameState> = {
  info: categoriesInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  recordsAction,
  allowsUndoVote,
  waitingOn,
  deadline,
  onDeadline,
  resumeClock,
  toPublicState,
  privateSeatView,
  finalStandings,
  secretState: state => seatFields(state, ['letters', 'pool'])
};
