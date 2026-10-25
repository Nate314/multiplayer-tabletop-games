import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffle } from '../../shared/shuffle.ts';
import {
  PLAYERS, allowsOutOfTurn, applyAction, applyMove, createGameState, onPlayerDisconnected, onPlayerLeft, resetLobby,
  toPublicState
} from './rules.ts';
import { SPECIAL_BUILD } from './specialBuild.ts';
import { CATAN_RULES } from './state.ts';
import type { GameState, PublicGameState } from './types.ts';

export const catan: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'catan',
    category: 'strategy',
    name: 'Catan',
    description: 'Settle an island, trade resources and build your way to the points to win (10 unless the host chose another)',
    ...PLAYERS,
    houseRules: [...CATAN_RULES, SPECIAL_BUILD]
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
