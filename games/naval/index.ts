import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { applyAction, applyMove, createGameState, resetLobby, toPublicState, waitingOn } from './rules.ts';
import { navalInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const naval: GameDefinition<GameState, PublicGameState> = {
  info: navalInfo,
  createGameState,
  resetLobby,
  applyMove,
  applyAction,
  waitingOn,
  toPublicState,
  privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['myFleet'])
};
