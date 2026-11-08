// Pure helpers for placing tiles this turn: rearranging the rack and moving a tile placed on the board
import type { Placement } from '../types.ts';

type Square = { row: number; col: number };

// A tile put on the board this turn, and the rack slot it came from
export type PendingTile = Placement & { slot: number };

// The rack order with `slot` moved to place `place`, the others keeping their order
export function moveInOrder(order: number[], slot: number, place: number): number[] {
  const rest = order.filter(other => other !== slot);
  return [...rest.slice(0, place), slot, ...rest.slice(place)];
}

// The pending tile on `from` moved to the empty square `to`, keeping its letter, blank and slot
export function movePending(pending: PendingTile[], from: Square, to: Square): PendingTile[] {
  return pending.map(tile => tile.row === from.row && tile.col === from.col ? { ...tile, row: to.row, col: to.col } : tile);
}
