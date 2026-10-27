import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import {
  applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft, onUndo, resetLobby, toPublicState, waitingOn
} from './rules.ts';
import { dominoesInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const dominoes: GameDefinition<GameState, PublicGameState> = {
  info: dominoesInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  waitingOn,
  onUndo,
  toPublicState,
  privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['hand']),
  finalStandings
};
