import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import {
  allowsOutOfTurn, applyAction, applyMove, createGameState, finalStandings, onPlayerLeft, privateSeatView, resetLobby, spectatorState, toPublicState
} from './rules.ts';
import { hintgridInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const hintgrid: GameDefinition<GameState, PublicGameState> = {
  info: hintgridInfo,
  createGameState,
  resetLobby,
  applyMove,
  allowsOutOfTurn,
  applyAction,
  onPlayerLeft,
  finalStandings,
  toPublicState,
  privateSeatView,
  spectatorState,
  spectatorsSeeEverySeat: true,
  secretState: state => (state.isGameOver ? {} : seatFields(state, ['key']))
};
