import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const yahtzee: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'yahtzee',
    category: 'dice',
    name: 'Yahtzee',
    description: 'Roll five dice up to three times and fill every scoring box',
    minPlayers: 2,
    maxPlayers: 8,
    stretchedPlayers: { min: 2, max: 10 }
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState
};
