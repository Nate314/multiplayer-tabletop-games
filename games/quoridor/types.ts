// Data shapes shared by the browser and the server
import type { BaseGameState } from '../../shared/types.ts';

export type { Result, Seat, UndoVote } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

export type Position = { row: number; col: number };

export type Orientation = 'horizontal' | 'vertical';

export type Wall = Position & { orientation: Orientation };

export type PlacedWall = Wall & { playerNumber: Seat };

// A wall as it arrives over the network, before validation
export type WallInput = { row: unknown; col: unknown; orientation: unknown };

export type Move =
  | { type: 'move'; row: number; col: number }
  | { type: 'wall'; row: number; col: number; orientation: Orientation };

export type LastMove =
  | { type: 'move'; playerNumber: Seat; from: Position; to: Position }
  | { type: 'wall'; playerNumber: Seat; row: number; col: number; orientation: Orientation };

export type GameState = BaseGameState & {
  pawns: Record<Seat, Position>;
  wallCounts: Record<Seat, number>;
  walls: PlacedWall[];
  lastMove: LastMove | null;
};

// The game state as the server sends it to browsers
export type PublicGameState = GameState & { undoAvailable: boolean; moveCount: number };

// The parts of the state that board geometry reads
export type BoardState = { pawns: Record<Seat, Position>; walls: Wall[]; activePlayers: Seat[] };
