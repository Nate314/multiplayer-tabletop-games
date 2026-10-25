import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { CHESS_RULES, applyAction, applyMove, createGameState, deadline, onDeadline, resetLobby, resumeClock, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const chess: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'chess',
    category: 'classic',
    name: 'Chess',
    description: 'Checkmate the enemy king in the classic two-player strategy game',
    minPlayers: 2,
    maxPlayers: 2,
    houseRules: CHESS_RULES
  },
  createGameState,
  resetLobby,
  applyMove,
  applyAction,
  deadline,
  onDeadline,
  resumeClock,
  toPublicState
};
