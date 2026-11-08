import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { allowsOutOfTurn, applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState, waitingOn } from './rules.ts';
import { rainboweightsInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const rainboweights: GameDefinition<GameState, PublicGameState> = {
  info: rainboweightsInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  waitingOn,
  allowsOutOfTurn,
  onUndo: (state, random) => ({ ...state, drawPile: shuffle(state.drawPile, random) }),
  toPublicState,
  // Not `revealed`: that is another seat's hand, which the challenger alone may see
  privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['hand', 'drawnCard']),
  finalStandings,
  secretState: state => seatFields(state, ['drawPile'])
};
