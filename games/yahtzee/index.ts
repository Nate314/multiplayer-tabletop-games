import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const yahtzee: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'yahtzee',
    name: 'Yahtzee',
    description: 'Roll five dice up to three times and fill every scoring box',
    minPlayers: 2,
    maxPlayers: 8
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState
};
