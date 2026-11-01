// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';
import type { Contributions, RaceBoards, RaceProgress } from '../../shared/puzzleModes.ts';
import type { PieceCount } from './cut.ts';
import type { PictureName } from './pictures.ts';

export type { Result, Seat } from '../../shared/types.ts';

export type Picture = { kind: 'builtin'; name: PictureName } | { kind: 'photo'; id: string }; // id: 32 lowercase hex
// x, y: the piece's top left on the table
export type Piece = { x: number; y: number; placed: boolean; heldBy: Seat | null; placedBy: Seat | null };
export type Board = { pieces: Piece[] }; // index = piece id
export type LastMove = { type: 'snap' | 'unsnap'; playerNumber: Seat; piece: number } | null;

export type GameState = BaseGameState & {
  picture: Picture;
  seed: number; // the cut's tabs and blanks
  count: PieceCount;
  board: Board; // Solo and Together; empty pieces in Race
  boards: RaceBoards<Board>; // Race only, one per seat, all scattered the same way
  snaps: Partial<Record<Seat, number[]>>; // each seat's snapped pieces in order, for undoOwn
  contributions: Contributions;
  lastMove: LastMove;
};

export type PublicGameState = BasePublicState & Omit<GameState, 'boards'> & {
  boards: RaceBoards<Board>;
  progress: RaceProgress; // every Race seat; empty otherwise
};
