import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyAction, applyMove, createGameState, deadline, onDeadline, onPlayerLeft, resetLobby, resumeClock, toPublicState } from './rules.ts';
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
  toPublicState
};
