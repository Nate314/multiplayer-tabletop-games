import { drawOfferAnswerers } from '../../shared/drawOffer.ts';
import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyAction, applyMove, createGameState, resetLobby, toPublicState } from './rules.ts';
import { tictactoeInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const tictactoe: GameDefinition<GameState, PublicGameState> = {
  info: tictactoeInfo,
  createGameState,
  resetLobby,
  applyMove,
  applyAction,
  waitingOn: drawOfferAnswerers,
  toPublicState
};
