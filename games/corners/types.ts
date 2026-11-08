// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';
import type { BoardKind, Cell } from './geometry.ts';

export type { Result, Seat } from '../../shared/types.ts';

export type Color = 0 | 1 | 2 | 3; // shown as Blue, Yellow, Red, Green
export type Owner = Seat | 'shared';
export type Placed = { color: Color; piece: number; cells: Cell[] };
export type LastMove =
  | { type: 'place'; playerNumber: Seat; color: Color; piece: number; cells: Cell[] }
  | null;

export type GameState = BaseGameState & {
  board: BoardKind; // copied from the rule at resetLobby
  owners: Record<Color, Owner>;
  turnColor: Color;
  sharedTurn: number; // how many times the shared color has been placed or passed
  used: Record<Color, number[]>; // piece ids placed, in order
  placed: Placed[];
  out: Color[]; // colors that pass for the rest of the game, in the order they went out
  lastMove: LastMove;
};

// The game state as the server sends it to browsers
export type PublicGameState = GameState & BasePublicState & {
  scores: Partial<Record<Seat, number>>;
  colorScores: Record<Color, number>;
};

export type Move = { type: 'place'; piece: number; orientation: number; dx: number; dy: number };
