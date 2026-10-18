import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffleEach } from '../../shared/shuffle.ts';
import { applyMove, createGameState, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const war: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'war',
    name: 'War',
    description: 'Flip cards, higher card takes both, and win the whole deck',
    minPlayers: 2,
    maxPlayers: 2
  },
  createGameState,
  resetLobby,
  applyMove,
  onUndo: (state, random) => ({ ...state, piles: shuffleEach(state.piles, random) }),
  toPublicState
};
