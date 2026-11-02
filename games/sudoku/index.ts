import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { sudokuInfo } from './info.ts';
import {
  allowsUndoVote, applyAction, applyMove, createGameState, finalStandings, onPlayerLeft, recordsAction, resetLobby, spectatorState, toPublicState, undoOwn
} from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const sudoku: GameDefinition<GameState, PublicGameState> = {
  info: sudokuInfo,
  createGameState,
  resetLobby,
  applyMove,
  applyAction,
  recordsAction,
  undoOwn,
  allowsUndoVote,
  continuesAlone: true,
  onPlayerLeft,
  finalStandings,
  toPublicState,
  privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['raceBoards', 'myNotes', 'boardWrong', 'ownUndo', 'lastMove']),
  spectatorState,
  secretState: state => seatFields(state, ['solution'])
};
