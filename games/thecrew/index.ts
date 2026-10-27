import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { applyAction, applyMove, createGameState, onPlayerDisconnected, onPlayerLeft, onUndo, resetLobby, toPublicState, waitingOn } from './rules.ts';
import { thecrewInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const thecrew: GameDefinition<GameState, PublicGameState> = {
  info: thecrewInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  onUndo,
  applyMove,
  applyAction,
  waitingOn,
  toPublicState,
  privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['hand', 'distress'])
};
