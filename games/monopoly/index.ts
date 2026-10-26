import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffleEach } from '../../shared/shuffle.ts';
import {
  applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState, seatsWaitedOn
} from './rules.ts';
import { monopolyInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const monopoly: GameDefinition<GameState, PublicGameState> = {
  info: monopolyInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  waitingOn: seatsWaitedOn,
  onUndo: (state, random) => ({ ...state, decks: shuffleEach(state.decks, random) }),
  toPublicState,
  finalStandings
};
