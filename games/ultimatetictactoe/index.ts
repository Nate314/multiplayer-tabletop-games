import { drawOfferAnswerers } from '../../shared/drawOffer.ts';
import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyAction, applyMove, createGameState, resetLobby, toPublicState } from './rules.ts';
import { ultimatetictactoeInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const ultimatetictactoe: GameDefinition<GameState, PublicGameState> = {
  info: ultimatetictactoeInfo,
  createGameState,
  resetLobby,
  applyMove,
  applyAction,
  waitingOn: drawOfferAnswerers,
  toPublicState
};
