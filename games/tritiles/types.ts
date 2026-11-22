// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';
import type { Board, Cell } from './grid.ts';
import type { PlayScore } from './scoring.ts';

export type { Result, Seat, UndoVote } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';
export type { Board, Cell, Placed } from './grid.ts';

// A tile is its index in TILES. `corners` is the tile as laid, read clockwise from the cell's first vertex
export type Move =
  | { type: 'play'; tile: number; cell: Cell; corners: [number, number, number] }
  | { type: 'draw' } // only when nothing fits, the pool is not empty and fewer than 3 tiles were drawn this turn
  | { type: 'pass' }; // only when nothing fits and drawing is not allowed

// Not turn-bound and not undoable
export type Action = { type: 'acknowledgeRound' };

// `score` is what the play earned; draw and pass record the points they cost
export type LastMove =
  | { type: 'play'; playerNumber: Seat; tile: number; cell: Cell; corners: [number, number, number]; score: PlayScore; wentOut: boolean }
  | { type: 'draw'; playerNumber: Seat; penalty: number }
  | { type: 'pass'; playerNumber: Seat; penalty: number };

// How a round went. `winner` is null when a blocked round ended in a tie for lowest. `points` is what each seat gained
export type RoundSummary = {
  roundNumber: number;
  winner: Seat | null;
  blocked: boolean;
  points: Record<Seat, number>;
  sumsLeft: Record<Seat, number>;
  acknowledged: Seat[]; // the next round waits for every connected player
};

// The full state, which never leaves the server: nobody may see the pool or another player's hand
export type GameState = BaseGameState & {
  roundNumber: number;
  scores: Record<Seat, number>;
  hands: Record<Seat, number[]>;
  pool: number[]; // the top tile is the last one
  board: Board;
  drawsThisTurn: number;
  leadTile: number | null; // the tile the round must open with; null once the board has a tile
  roundSummary: RoundSummary | null;
  lastMove: LastMove | null;
};

// The game state as the server sends it to one browser: only that player's own hand
export type PublicGameState =
  Omit<GameState, 'hands' | 'pool'> &
  BasePublicState & {
    hand: number[]; // the viewer's own hand; empty for the history
    handCounts: Record<Seat, number>;
    poolCount: number;
  };
