import { drawOfferAnswerers } from '../../shared/drawOffer.ts';
import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyAction, applyMove, createGameState, resetLobby, toPublicState } from './rules.ts';
import { fourinarowInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const fourinarow: GameDefinition<GameState, PublicGameState> = {
  info: fourinarowInfo,
  createGameState,
  resetLobby,
  applyMove,
  applyAction,
  waitingOn: drawOfferAnswerers,
  toPublicState
};
