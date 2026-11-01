// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';
import type { DrawOfferState } from '../../shared/drawOffer.ts';
import type { Cells } from './lines.ts';
import type { MarkState } from './marks.ts';

export type { Result, Seat } from '../../shared/types.ts';

export type Move = { type: 'place'; cell: number };

export type LastMove = { playerNumber: Seat; cell: number };

// Resigning and draw offers are the shared EndingAction (shared/drawOffer.ts)
export type GameState = BaseGameState & DrawOfferState & MarkState & {
  board: Cells; // cells 0 to 8, row-major from the top left; each holds the seat that marked it, or null
  lastMove: LastMove | null;
  winningLine: number[] | null; // the three cells that won the game
};

// The game state as the server sends it to browsers
export type PublicGameState = GameState & BasePublicState;
