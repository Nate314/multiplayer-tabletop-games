// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Result, Seat } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

// Points are indexed 0 to 23. Seat 1 moves from 23 down to 0, seat 2 from 0 up to 23.
export type PointStack = { seat: Seat; count: number };

export type From = number | 'bar';
export type To = number | 'off';

export type Move = { type: 'move'; from: From; to: To };

// One checker moved by one die
export type Step = { from: From; to: To; die: number };

// The parts of the state that move generation reads and changes
export type Position = {
  points: (PointStack | null)[];
  bar: Record<Seat, number>;
  borneOff: Record<Seat, number>;
};

export type LastMove = { playerNumber: Seat; from: From; to: To; hit: boolean };

export type GameState = BaseGameState & Position & {
  dice: number[]; // this turn's roll; empty until two players are seated
  remaining: number[]; // dice not used yet this turn; a double starts with four
  lastMove: LastMove | null;
};

// The game state as the server sends it to browsers
export type PublicGameState = GameState & BasePublicState;
