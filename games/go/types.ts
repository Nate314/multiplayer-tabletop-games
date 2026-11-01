import type { DrawOfferState } from '../../shared/drawOffer.ts';
import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';
import type { AreaScore } from './scoring.ts';

export type { Result, Seat } from '../../shared/types.ts';

export type Stone = 'black' | 'white';
export type Point = { row: number; col: number }; // row 0 is the top edge, col 0 is column A
export type Board = (Stone | null)[][];
export type BoardSize = 9 | 13 | 19;

export type Phase = 'play' | 'marking';

export type Move = { type: 'place'; row: number; col: number } | { type: 'pass' };

export type Action = { type: 'resign' } | { type: 'mark'; row: number; col: number } | { type: 'agree' } | { type: 'resume' };

export type LastMove =
  | { type: 'place'; playerNumber: Seat; point: Point; captured: number }
  | { type: 'pass'; playerNumber: Seat }
  | { type: 'score'; playerNumber: Seat; score: AreaScore }; // the agreement that finished the count

export type GameState = BaseGameState & DrawOfferState & {
  size: BoardSize;
  board: Board;
  phase: Phase;
  previousKey: string | null; // boardKey before the last move (a pass included), for the ko rule
  passes: number; // passes in a row, 0 to 2
  captures: Record<Stone, number>; // stones each color has captured
  dead: Point[]; // stones marked dead, only while marking
  agreed: Seat[]; // seats that agreed to the current marks
  lastMove: LastMove | null;
  score: AreaScore | null; // set when the count ends the game
};

// The game state as the server sends it to browsers
export type PublicGameState = GameState & BasePublicState & { projected: AreaScore | null }; // the live count while marking
