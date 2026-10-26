import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft, onUndo, resetLobby, toPublicState } from './rules.ts';
import { rackoInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const racko: GameDefinition<GameState, PublicGameState> = {
  info: rackoInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  onUndo,
  applyMove,
  applyAction,
  toPublicState,
  privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['myRack', 'myHeld']),
  finalStandings
};
