// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Result, Seat } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

// Points are indexed 0 to 23. Seat 1 moves from 23 down to 0, seat 2 from 0 up to 23.
export type PointStack = { seat: Seat; count: number };

export type From = number | 'bar';
export type To = number | 'off';

// A turn starts with a roll, or a double that the opponent takes or drops. `die` picks which die moves a
// checker when two could, as when either die bears off the same checker; without it the smaller is used.
export type Move =
  | { type: 'move'; from: From; to: To; die?: number }
  | { type: 'roll' }
  | { type: 'double' }
  | { type: 'take' }
  | { type: 'drop' };

// One checker moved by one die
export type Step = { from: From; to: To; die: number };

// The parts of the state that move generation reads and changes
export type Position = {
  points: (PointStack | null)[];
  bar: Record<Seat, number>;
  borneOff: Record<Seat, number>;
};

// `blocked` is a roll the player could not use, which passed the turn. `cube` is the value offered, taken or dropped.
export type LastMove =
  | { type: 'move'; playerNumber: Seat; from: From; to: To; hit: boolean }
  | { type: 'roll'; playerNumber: Seat; dice: number[]; blocked: boolean }
  | { type: 'double'; playerNumber: Seat; cube: number }
  | { type: 'take'; playerNumber: Seat; cube: number }
  | { type: 'drop'; playerNumber: Seat; cube: number };

export type GameState = BaseGameState & Position & {
  dice: number[]; // this turn's roll; empty until the player to move has rolled
  remaining: number[]; // dice not used yet this turn; a double starts with four
  cube: number; // the doubling cube's value, the stake of the game
  cubeOwner: Seat | null; // who may double next; null while the cube is in the middle
  doubleOffer: Seat | null; // who offered a double that currentPlayer must take or drop
  pointsWon: number; // the winner's points once the game is over
  lastMove: LastMove | null;
};

// The game state as the server sends it to browsers
export type PublicGameState = GameState & BasePublicState;
