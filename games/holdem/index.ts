import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { holdemInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const holdem: GameDefinition<GameState, PublicGameState> = {
  info: holdemInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  onUndo: (state, random) => ({ ...state, deck: shuffle(state.deck, random) }),
  toPublicState,
  finalStandings
};
