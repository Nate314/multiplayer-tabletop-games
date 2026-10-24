import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { SCRABBLE_RULES, applyAction, applyMove, createGameState, deadline, onDeadline, onPlayerLeft, resetLobby, resumeClock, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const scrabble: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'scrabble',
    category: 'tile',
    name: 'Scrabble',
    description: 'Build crossing words from your letter tiles on the premium-square board',
    minPlayers: 2,
    maxPlayers: 4,
    houseRules: SCRABBLE_RULES
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  applyAction,
  deadline,
  onDeadline,
  resumeClock,
  toPublicState
};
