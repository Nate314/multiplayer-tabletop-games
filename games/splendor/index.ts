import type { GameDefinition } from '../../shared/gameDefinition.ts';
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
  finalStandings
};
