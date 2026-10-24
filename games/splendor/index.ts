import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffleEach } from '../../shared/shuffle.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const splendor: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'splendor',
    category: 'strategy',
    name: 'Splendor',
    description: 'Collect gems, buy development cards and attract nobles to reach 15 prestige',
    minPlayers: 2,
    maxPlayers: 4
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  onUndo: (state, random) => ({ ...state, decks: shuffleEach(state.decks, random) }),
  toPublicState
};
