import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState, waitingOn } from './rules.ts';
import { azulInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const azul: GameDefinition<GameState, PublicGameState> = {
  info: azulInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  waitingOn,
  onUndo: (state, random) => ({ ...state, bag: shuffle(state.bag, random) }),
  toPublicState,
  finalStandings,
  secretState: state => seatFields(state, ['bag'])
};
