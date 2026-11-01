import { drawOfferAnswerers } from '../../shared/drawOffer.ts';
import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyAction, applyMove, createGameState, resetLobby, toPublicState } from './rules.ts';
import { goInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const go: GameDefinition<GameState, PublicGameState> = {
  info: goInfo,
  createGameState,
  resetLobby,
  applyMove,
  applyAction,
  waitingOn: drawOfferAnswerers,
  toPublicState
};
