import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffle } from '../../shared/shuffle.ts';
import {
  MIN_PLAYERS, applyAction, applyMove, createGameState, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState
} from './rules.ts';
import { CATAN_RULES } from './state.ts';
import type { GameState, PublicGameState } from './types.ts';

export const catan: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'catan',
    category: 'strategy',
    name: 'Catan',
    description: 'Settle an island, trade resources and build your way to 10 points',
    minPlayers: MIN_PLAYERS,
    maxPlayers: 4,
    houseRules: CATAN_RULES
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  onUndo: (state, random) => ({ ...state, devDeck: shuffle(state.devDeck, random) }),
  toPublicState
};
