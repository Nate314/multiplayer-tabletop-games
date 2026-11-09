import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';

export type { Result, Seat } from '../../shared/types.ts';

// Board units, viewBox 0 0 1000 640
export type Point = [number, number];
// path[0] is the rest spot, the last point the exit
export type Part = { id: number; name: string; value: number; width: number; path: Point[] };
export type Live = { seat: Seat; part: number; at: Point };
export type LastMove =
  | { type: 'out'; playerNumber: Seat; part: number; value: number }
  | { type: 'buzz'; playerNumber: Seat; part: number; at: Point }
  | null;

export type GameState = BaseGameState & {
  outBy: Partial<Record<number, Seat>>; // part id to the seat that brought it out
  scores: Partial<Record<Seat, number>>;
  buzzes: Partial<Record<Seat, number>>; // used
  live: Live | null;
  lastMove: LastMove;
};

export type PublicGameState = GameState & BasePublicState;

export type Move = { type: 'out'; part: number } | { type: 'buzz'; part: number; at: Point };
export type Action = { type: 'pick'; part: number } | { type: 'drag'; at: Point } | { type: 'drop' };
