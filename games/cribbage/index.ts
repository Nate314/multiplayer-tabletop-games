import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { allowsOutOfTurn, applyMove, createGameState, finalStandings, onPlayerLeft, onUndo, resetLobby, toPublicState } from './rules.ts';
import { applyAction, deadline, onDeadline, onPlayerDisconnected, recordsAction, resumeClock, waitingOn } from './show.ts';
import { cribbageInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const cribbage: GameDefinition<GameState, PublicGameState> = {
  info: cribbageInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  onUndo,
  applyMove,
  allowsOutOfTurn,
  applyAction,
  recordsAction,
  waitingOn,
  deadline,
  onDeadline,
  resumeClock,
  toPublicState,
  privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['hand']),
  finalStandings,
  secretState: state => seatFields(state, ['deck', 'crib'])
};
