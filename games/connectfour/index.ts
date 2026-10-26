import { drawOfferAnswerers } from '../../shared/drawOffer.ts';
import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyAction, applyMove, createGameState, resetLobby, toPublicState } from './rules.ts';
import { connectfourInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const connectfour: GameDefinition<GameState, PublicGameState> = {
  info: connectfourInfo,
  createGameState,
  resetLobby,
  applyMove,
  applyAction,
  waitingOn: drawOfferAnswerers,
  toPublicState
};
