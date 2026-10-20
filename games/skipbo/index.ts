import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const skipbo: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'skipbo',
    category: 'card',
    name: 'Skip-Bo',
    description: 'Build piles from 1 to 12 and be first to empty your stock pile',
    minPlayers: 2,
    maxPlayers: 6
  },
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
  toPublicState
};
