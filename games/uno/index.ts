import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { allowsOutOfTurn, applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { unoInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const uno: GameDefinition<GameState, PublicGameState> = {
  info: unoInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  allowsOutOfTurn,
  onUndo: (state, random) => ({ ...state, drawPile: shuffle(state.drawPile, random) }),
  toPublicState,
  privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['hand', 'drawnCard', 'revealed']),
  finalStandings
};
