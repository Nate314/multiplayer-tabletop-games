import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import {
  allowsUndoVote, applyAction, applyMove, createGameState, deadline, finalStandings, onDeadline, onPlayerLeft, privateSeatView,
  recordsAction, resetLobby, resumeClock, toPublicState, waitingOn
} from './rules.ts';
import { fictionaryInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

// No spectatorState: a spectator sees the table view and may ask to see a seat
export const fictionary: GameDefinition<GameState, PublicGameState> = {
  info: fictionaryInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
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
  secretState: state => seatFields(state, state.phase === 'reveal' || state.isGameOver ? ['deck'] : ['deck', 'definition'])
};
