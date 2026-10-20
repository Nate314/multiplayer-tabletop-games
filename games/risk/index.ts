import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { MIN_PLAYERS } from './state.ts';
import type { GameState, PublicGameState } from './types.ts';

export const risk: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'risk',
    category: 'strategy',
    name: 'Risk',
    description: 'Raise armies, roll for battles and conquer all 42 territories of the world',
    minPlayers: MIN_PLAYERS,
    maxPlayers: 6
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  onUndo: (state, random) => ({ ...state, deck: shuffle(state.deck, random) }),
  toPublicState
};
