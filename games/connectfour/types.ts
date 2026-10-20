// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';
import type { DrawOfferState } from '../../shared/drawOffer.ts';

export type { Result, Seat } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

export type Position = { row: number; col: number };

// Row 0 is the top. Each cell holds the seat whose disc fills it, or null.
export type Board = (Seat | null)[][];

export type Move = { type: 'drop'; column: number };

export type LastMove = { playerNumber: Seat; row: number; column: number };

// Resigning and draw offers are the shared EndingAction (shared/drawOffer.ts)
export type GameState = BaseGameState & DrawOfferState & {
  board: Board;
  lastMove: LastMove | null;
  winningLine: Position[] | null; // the four cells that won the game
};

// The game state as the server sends it to browsers
export type PublicGameState = GameState & BasePublicState;
