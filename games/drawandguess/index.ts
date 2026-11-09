import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import {
  applyAction, applyMove, createGameState, deadline, finalStandings, onDeadline, onPlayerLeft, privateSeatView, recordsAction,
  resetLobby, resumeClock, spectatorState, toPublicState
} from './rules.ts';
import { drawandguessInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const drawandguess: GameDefinition<GameState, PublicGameState> = {
  info: drawandguessInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  applyAction,
  recordsAction,
  deadline,
  onDeadline,
  resumeClock,
  toPublicState,
  privateSeatView,
  spectatorState,
  spectatorsSeeEverySeat: true,
  finalStandings,
  secretState: state => seatFields(state, ['deck'])
};
