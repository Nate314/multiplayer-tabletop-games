// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Random, Result, Seat } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

export type Hole = { q: number; r: number }; // axial coordinates, s = -q - r

export type PointIndex = 0 | 1 | 2 | 3 | 4 | 5; // clockwise from the bottom

export type Move = { type: 'move'; path: Hole[] }; // the marble's hole, then every landing

export type LastMove = { playerNumber: Seat; path: Hole[] };

export type GameState = BaseGameState & {
  holes: Record<string, Seat>; // holeKey -> owner, occupied holes only
  points: Partial<Record<Seat, PointIndex>>; // each seated player's start point; a leaver has no entry
  lastMove: LastMove | null;
};

// The game state as the server sends it to browsers
export type PublicGameState = GameState & BasePublicState;
