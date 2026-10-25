import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { RACKO_RULES, applyAction, applyMove, createGameState, onPlayerDisconnected, onPlayerLeft, onUndo, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const racko: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'racko',
    category: 'card',
    name: 'Rack-O',
    description: 'Draw and swap cards to put your ten-slot rack in order',
    minPlayers: 2,
    maxPlayers: 4,
    houseRules: RACKO_RULES
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  onUndo,
  applyMove,
  applyAction,
  toPublicState
};
