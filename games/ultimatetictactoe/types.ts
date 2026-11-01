// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';
import type { DrawOfferState } from '../../shared/drawOffer.ts';
import type { Cells } from '../tictactoe/lines.ts';
import type { MarkState } from '../tictactoe/marks.ts';

export type { Result, Seat } from '../../shared/types.ts';

export type Move = { type: 'place'; board: number; cell: number }; // both 0 to 8, row-major from the top left

export type LastMove = { playerNumber: Seat; board: number; cell: number; claimed: boolean };

// Who holds a small board: a seat that got three in a row, 'draw' when full with no line, null while open
export type BoardResult = Seat | 'draw' | null;

// Resigning and draw offers are the shared EndingAction (shared/drawOffer.ts)
export type GameState = BaseGameState & DrawOfferState & MarkState & {
  boards: Cells[]; // the nine small boards, row-major; each holds the seat that marked a cell, or null
  forcedBoard: number | null; // where the current player must play; null for any open board
  lastMove: LastMove | null;
  winningLine: number[] | null; // the three claimed boards that won the game
};

// The game state as the server sends it to browsers
export type PublicGameState = GameState & BasePublicState;
