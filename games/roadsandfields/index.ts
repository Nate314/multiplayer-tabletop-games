import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { applyMove, createGameState, finalStandings, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { roadsandfieldsInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const roadsandfields: GameDefinition<GameState, PublicGameState> = {
  info: roadsandfieldsInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  onUndo: (state, random) => ({ ...state, drawPile: shuffle(state.drawPile, random) }),
  toPublicState,
  finalStandings,
  secretState: state => seatFields(state, ['drawPile'])
};
