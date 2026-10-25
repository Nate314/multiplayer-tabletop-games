import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { phase10Info } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const phase10: GameDefinition<GameState, PublicGameState> = {
  info: phase10Info,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  onUndo: (state, random) => ({ ...state, drawPile: shuffle(state.drawPile, random) }),
  toPublicState,
  finalStandings
};
