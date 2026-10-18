// Helpers for the Carcassonne tests: a game under way with a chosen board and draw pile
import { applyMove as play } from '../../shared/seating.ts';
import { carcassonne } from './index.ts';
import { createGameState } from './rules.ts';
import type { FeatureRef, GameState, Meeple, Placement, Result, Seat, TileType } from './types.ts';

// A placement for a test board
export function at(x: number, y: number, tile: TileType, rotation = 0, meeple: Meeple | null = null): Placement {
  return { x, y, tile, rotation, by: meeple?.seat ?? null, meeple };
}

export const START = at(0, 0, 'D');

// Three players, Alice to place `currentTile`, with the start tile alone on the board unless a board is given.
// The draw pile is drawn from its end.
export function game(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createGameState('g'),
    started: true,
    activePlayers: [1, 2, 3],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara' },
    currentPlayer: 1,
    board: [START],
    drawPile: ['U', 'U', 'U'],
    currentTile: 'E',
    scores: { 1: 0, 2: 0, 3: 0 },
    ...overrides
  };
}

export function ok(result: Result<GameState>): GameState {
  if ('error' in result) throw new Error(result.error);
  return result.state;
}

// Through the platform's turn checks, as the server applies a move
export const move = (state: GameState, seat: Seat, value: unknown) => play(carcassonne, state, seat, value, () => 0);

// The error a move is refused with, or null when it is accepted
export function refused(state: GameState, seat: Seat, value: unknown): string | null {
  const result = move(state, seat, value);
  return 'error' in result ? result.error : null;
}

export const played =(state: GameState, seat: Seat, value: unknown) => ok(move(state, seat, value));

// A whole turn: the tile, then a meeple or none
export function turn(state: GameState, seat: Seat, x: number, y: number, rotation: number, feature: FeatureRef | null = null): GameState {
  const placed = played(state, seat, { type: 'place', x, y, rotation });
  return played(placed, seat, { type: 'meeple', feature });
}
