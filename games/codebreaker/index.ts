import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import {
  allowsUndoVote, applyAction, applyMove, createGameState, finalStandings, isRevealed, onPlayerDisconnected, onPlayerLeft,
  recordsAction, resetLobby, spectatorState, toPublicState, undoOwn, waitingOn
} from './rules.ts';
import { codebreakerInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const codebreaker: GameDefinition<GameState, PublicGameState> = {
  info: codebreakerInfo,
  continuesAlone: true,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  recordsAction,
  undoOwn,
  allowsUndoVote,
  waitingOn,
  finalStandings,
  toPublicState,
  spectatorState,
  privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['code', 'boards']),
  // The computer's code is hidden from everyone until it is revealed; a maker's own code is privateSeatView
  secretState: state => state.maker === null && !isRevealed(state) ? seatFields(state, ['code']) : {}
};
