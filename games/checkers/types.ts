// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';
import type { DrawOfferState } from '../../shared/drawOffer.ts';

export type { Result, Seat } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

export type Position = { row: number; col: number };

export type Piece = { seat: Seat; king: boolean };

// Row 0 is the top, where seat 2 starts; seat 1 starts at the bottom. Light squares are always null.
export type Board = (Piece | null)[][];

// A whole turn: the piece's square, then every square it lands on (several for a multi-jump)
export type Move = { type: 'move'; path: Position[] };

export type LastMove = { playerNumber: Seat; path: Position[]; captured: Position[]; crowned: boolean };

// Resigning and draw offers are the shared EndingAction (shared/drawOffer.ts)
export type GameState = BaseGameState & DrawOfferState & {
  board: Board;
  lastMove: LastMove | null;
};

// The game state as the server sends it to browsers
export type PublicGameState = GameState & BasePublicState;
