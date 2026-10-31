import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { applyMove, createGameState, finalStandings, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { skipboInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const skipbo: GameDefinition<GameState, PublicGameState> = {
  info: skipboInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  // A stock is face down below its top card, so only the cards under the top are reshuffled
  onUndo: (state, random) => ({
    ...state,
    drawPile: shuffle(state.drawPile, random),
    stocks: Object.fromEntries(Object.entries(state.stocks).map(([seat, stock]) => [seat, [...shuffle(stock.slice(0, -1), random), ...stock.slice(-1)]]))
  }),
  toPublicState,
  privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['myHand']),
  finalStandings,
  secretState: state => seatFields(state, ['drawPile', 'stocks'])
};
