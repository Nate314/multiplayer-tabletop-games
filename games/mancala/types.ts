// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Result, Seat } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

// A stone's color is the seat whose side it started on, and it keeps that color wherever it goes
export type Stone = Seat;

// The board is 14 holes counter-clockwise: seat 1's pits 0-5, its bank 6, seat 2's pits 7-12, its bank 13.
// Each hole lists its stones in the order they arrived.
export type Board = Stone[][];

// One stone taken from the front of a hole and added to the end of another
export type Transfer = { from: number; to: number };

// `pit` is a board index on the mover's side
export type Move = { pit: number };

export type LastMove = {
  playerNumber: Seat;
  pit: number; // where the first stones were picked up
  end: number; // where the last stone of the chain landed
  pickedUp: number; // stones in the first pickup
  laps: number; // pickups in the chain, 1 when the first lap ended in an empty pit or the bank
  extraTurn: boolean;
};

export type GameState = BaseGameState & {
  board: Board;
  lastMove: LastMove | null;
};

// The game state as the server sends it to browsers
export type PublicGameState = GameState & BasePublicState;
