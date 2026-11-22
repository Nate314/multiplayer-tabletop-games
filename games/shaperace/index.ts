import type { GameDefinition } from '../../shared/gameDefinition.ts';
import {
  allowsUndoVote, applyAction, applyMove, createGameState, deadline, finalStandings, onDeadline, onPlayerLeft, privateSeatView,
  recordsAction, resetLobby, resumeClock, spectatorState, toPublicState
} from './rules.ts';
import { shaperaceInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const shaperace: GameDefinition<GameState, PublicGameState> = {
  info: shaperaceInfo,
  createGameState,
  resetLobby,
  continuesAlone: true,
  onPlayerLeft,
  applyMove,
  applyAction,
  recordsAction,
  allowsUndoVote,
  deadline,
  onDeadline,
  resumeClock,
  finalStandings,
  toPublicState,
  privateSeatView,
  spectatorsSeeEverySeat: true,
  spectatorState
};
