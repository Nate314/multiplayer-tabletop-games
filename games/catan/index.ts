import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffle } from '../../shared/shuffle.ts';
import {
  MAX_PLAYERS, MIN_PLAYERS, allowsOutOfTurn, applyAction, applyMove, createGameState, onPlayerDisconnected, onPlayerLeft, resetLobby,
  toPublicState
} from './rules.ts';
import { SPECIAL_BUILD } from './specialBuild.ts';
import type { GameState, PublicGameState } from './types.ts';

export const catan: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'catan',
    category: 'strategy',
    name: 'Catan',
    description: 'Settle an island, trade resources and build your way to 10 points',
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    houseRules: [SPECIAL_BUILD]
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  allowsOutOfTurn,
  applyAction,
  onUndo: (state, random) => ({ ...state, devDeck: shuffle(state.devDeck, random) }),
  toPublicState
};
