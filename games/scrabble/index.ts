import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { applyAction, applyMove, createGameState, finalStandings, deadline, onDeadline, onPlayerLeft, resetLobby, resumeClock, toPublicState } from './rules.ts';
import { scrabbleInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const scrabble: GameDefinition<GameState, PublicGameState> = {
  info: scrabbleInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  applyAction,
  deadline,
  onDeadline,
  resumeClock,
  toPublicState,
  privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['rack']),
  finalStandings
};
