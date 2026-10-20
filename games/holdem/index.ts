import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { applyAction, applyMove, createGameState, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const holdem: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'holdem',
    category: 'card',
    name: "Texas Hold'em",
    description: 'Two private cards, five shared ones, and betting with play chips',
    minPlayers: 2,
    maxPlayers: 8
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  onUndo: (state, random) => ({ ...state, deck: shuffle(state.deck, random) }),
  toPublicState
};
