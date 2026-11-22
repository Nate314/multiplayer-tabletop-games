import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import {
  applyAction, applyMove, createGameState, deadline, finalStandings, onDeadline, onPlayerLeft, onUndo, recordsAction, resetLobby,
  resumeClock, toPublicState
} from './rules.ts';
import { bingoInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const bingo: GameDefinition<GameState, PublicGameState> = {
  info: bingoInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onUndo,
  applyMove,
  applyAction,
  recordsAction,
  deadline,
  onDeadline,
  resumeClock,
  toPublicState,
  finalStandings,
  secretState: state => seatFields(state, ['pool'])
};
