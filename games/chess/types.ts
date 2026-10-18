// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

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

export type Move =
  | { type: 'move'; from: Square; to: Square; promotion?: PromotionType }
  | { type: 'resign' };

export type LastMove =
  | { type: 'move'; playerNumber: Seat; from: Square; to: Square; notation: string }
  | { type: 'resign'; playerNumber: Seat };

// The parts of the state that move generation reads
export type BoardState = {
  board: Board;
  castling: CastlingRights;
  enPassant: Square | null; // the square a pawn just skipped over, which an enemy pawn may capture onto
};

export type GameState = BaseGameState & BoardState & {
  // Position keys since the last capture or pawn move, the current one last: for threefold repetition and the 50-move rule
  positions: string[];
  captured: Record<Color, PieceType[]>; // pieces of each color taken so far
  lastMove: LastMove | null;
};

// The game state as the server sends it to browsers
export type PublicGameState = GameState & BasePublicState;
