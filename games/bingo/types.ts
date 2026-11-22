// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';

export type { Result, Seat } from '../../shared/types.ts';

// 25 numbers, index row * 5 + col; the center (index 12) is 0 for the free square
export type Card = number[];

export type Pattern = 'line' | 'corners' | 'blackout';

export type LastMove =
  | { type: 'call'; seat: Seat; number: number }
  | { type: 'bingo'; seat: Seat; place: number };

// The full state, which never leaves the server: nobody may see the order of the uncalled numbers
export type GameState = BaseGameState & {
  pool: number[]; // uncalled numbers, the next call is the first one
  called: number[]; // in the order called
  cards: Record<Seat, Card[]>;
  marks: Record<Seat, number[][]>; // marks[seat][card]: the marked square indexes
  places: Record<Seat, number>; // the place each placed seat won
  openPlace: { place: number; closesAt: number } | null; // the place still open for claims
  finalUntil: number | null; // when the game ends after the 75th call
  lastMove: LastMove | null;
};

// The game state as the server sends it: everything except the uncalled numbers
export type PublicGameState = Omit<GameState, 'pool'> & BasePublicState;
