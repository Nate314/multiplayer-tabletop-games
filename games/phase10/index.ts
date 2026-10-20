import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { applyAction, applyMove, createGameState, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const phase10: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'phase10',
    category: 'card',
    name: 'Phase 10',
    description: 'Collect sets and runs to complete ten phases first',
    minPlayers: 2,
    maxPlayers: 6
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  onUndo: (state, random) => ({ ...state, drawPile: shuffle(state.drawPile, random) }),
  toPublicState
};
