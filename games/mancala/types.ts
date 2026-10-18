// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Result, Seat } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

// The board is 14 holes counter-clockwise: seat 1's pits 0-5, its store 6, seat 2's pits 7-12, its store 13
export type Board = number[];

// `pit` is a board index on the mover's side
export type Move = { pit: number };

export type LastMove = {
  playerNumber: Seat;
  pit: number; // where the seeds were picked up
  end: number; // where the last seed landed
  sown: number;
  captured: number; // seeds moved into the store by a capture, 0 when there was none
  extraTurn: boolean;
};

export type GameState = BaseGameState & {
  board: Board;
  lastMove: LastMove | null;
};

// The game state as the server sends it to browsers
export type PublicGameState = GameState & BasePublicState;
