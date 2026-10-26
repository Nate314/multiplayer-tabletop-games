import { drawOfferAnswerers } from '../../shared/drawOffer.ts';
import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyAction, applyMove, createGameState, deadline, onDeadline, resetLobby, resumeClock, toPublicState } from './rules.ts';
import { chessInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const chess: GameDefinition<GameState, PublicGameState> = {
  info: chessInfo,
  createGameState,
  resetLobby,
  applyMove,
  applyAction,
  waitingOn: drawOfferAnswerers,
  deadline,
  onDeadline,
  resumeClock,
  toPublicState
};
