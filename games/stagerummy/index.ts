import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState, waitingOn } from './rules.ts';
import { stagerummyInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const stagerummy: GameDefinition<GameState, PublicGameState> = {
  info: stagerummyInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  waitingOn,
  onUndo: (state, random) => ({ ...state, drawPile: shuffle(state.drawPile, random) }),
  toPublicState,
  privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['myHand']),
  finalStandings,
  secretState: state => seatFields(state, ['drawPile'])
};
