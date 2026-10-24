// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';
import type { DrawOfferState } from '../../shared/drawOffer.ts';

export type { Result, Seat } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

export type Color = 'white' | 'black';

export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';

export type PromotionType = 'queen' | 'rook' | 'bishop' | 'knight';

export type Piece = { color: Color; type: PieceType };

// Row 0 is rank 8 (black's back rank) and row 7 is rank 1; col 0 is the a-file
export type Square = { row: number; col: number };

export type Board = (Piece | null)[][];

export type CastlingRights = Record<Color, { kingSide: boolean; queenSide: boolean }>;

// `claimDraw` claims a draw by repetition or the fifty-move rule for the position this move produces
export type Move = { type: 'move'; from: Square; to: Square; promotion?: PromotionType; claimDraw?: boolean };

// Resigning and draw offers are the shared EndingAction; a claim stands on the position on the board
export type Action = { type: 'claimDraw' };

export type LastMove = { playerNumber: Seat; from: Square; to: Square; notation: string };

// The parts of the state that move generation reads
export type BoardState = {
  board: Board;
  castling: CastlingRights;
  enPassant: Square | null; // the square a pawn just skipped over, which an enemy pawn may capture onto
};

// Time left for each seat as of the last move, and the server time the player to move started using theirs
// (null while no clock runs: clock off, a lobby that is not ready, or a finished game)
export type ChessClock = { remainingMs: Record<Seat, number>; runningSince: number | null };

export type GameState = BaseGameState & BoardState & DrawOfferState & {
  // Position keys since the last capture or pawn move, the current one last: for repetition and the 50- and 75-move rules
  positions: string[];
  captured: Record<Color, PieceType[]>; // pieces of each color taken so far
  lastMove: LastMove | null;
  clock: ChessClock | null; // null with the clock off
};

// The game state as the server sends it to browsers
export type PublicGameState = GameState & BasePublicState;
