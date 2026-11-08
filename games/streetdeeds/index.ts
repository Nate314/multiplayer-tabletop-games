import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { shuffleEach } from '../../shared/shuffle.ts';
import {
  applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState, seatsWaitedOn
} from './rules.ts';
import { streetdeedsInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const streetdeeds: GameDefinition<GameState, PublicGameState> = {
  info: streetdeedsInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  waitingOn: seatsWaitedOn,
  onUndo: (state, random) => ({ ...state, decks: shuffleEach(state.decks, random) }),
  toPublicState,
  finalStandings,
  secretState: state => seatFields(state, ['decks'])
};
