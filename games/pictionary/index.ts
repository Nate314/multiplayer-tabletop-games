import type { GameDefinition } from '../../shared/gameDefinition.ts';
import {
  applyAction, applyMove, createGameState, deadline, onDeadline, onPlayerLeft, recordsAction, resetLobby, resumeClock, toPublicState
} from './rules.ts';
import { pictionaryInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const pictionary: GameDefinition<GameState, PublicGameState> = {
  info: pictionaryInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  applyAction,
  recordsAction,
  deadline,
  onDeadline,
  resumeClock,
  toPublicState
};
