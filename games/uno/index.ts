import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { UNO_RULES, applyAction, applyMove, createGameState, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const uno: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'uno',
    category: 'card',
    name: 'UNO',
    description: 'Match colors and numbers, empty your hand and be first to the target score (500 unless the host chose another)',
    minPlayers: 2,
    maxPlayers: 8,
    houseRules: UNO_RULES
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
