import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { shuffleEach } from '../../shared/shuffle.ts';
import { applyMove, createGameState, finalStandings, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { splendorInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const splendor: GameDefinition<GameState, PublicGameState> = {
  info: splendorInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  onUndo: (state, random) => ({ ...state, decks: shuffleEach(state.decks, random) }),
  toPublicState,
  privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['players']),
  finalStandings,
  secretState: state => seatFields(state, ['decks'])
};
