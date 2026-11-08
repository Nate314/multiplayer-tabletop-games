import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft, onUndo, resetLobby, toPublicState, waitingOn } from './rules.ts';
import { inorderInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const inorder: GameDefinition<GameState, PublicGameState> = {
  info: inorderInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  onUndo,
  applyMove,
  applyAction,
  waitingOn,
  toPublicState,
  privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['myRack', 'myHeld']),
  finalStandings,
  secretState: state => seatFields(state, ['drawPile'])
};
