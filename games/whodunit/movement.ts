import { DOORS, isCorridor } from './board.ts';
import type { Cell, Position } from './board.ts';
import type { RoomId } from './content.ts';

const key = (c: Cell) => `${c.row},${c.col}`;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Exact-length simple paths through corridors; stepping from a door's outside cell into its room ends the move early.
export function destinations(from: Position, steps: number, occupied: Cell[], leftRoom: RoomId | null): Position[] {
  const blocked = new Set(occupied.map(key));
  const found = new Map<string, Position>();
  const banned = 'room' in from ? from.room : leftRoom;
  const visited = new Set<string>();

  const walk = (cell: Cell, remaining: number): void => {
    if (remaining === 0) { found.set(key(cell), cell); return; }
    for (const d of DOORS) {
      if (d.room !== banned && key(d.outside) === key(cell)) found.set(d.room, { room: d.room });
    }
    for (const [dr, dc] of STEPS) {
      const next = { row: cell.row + dr, col: cell.col + dc };
      const k = key(next);
      if (!isCorridor(next) || blocked.has(k) || visited.has(k)) continue;
      visited.add(k);
      walk(next, remaining - 1);
      visited.delete(k);
    }
  };

  if ('room' in from) {
    for (const d of DOORS) {
      const k = key(d.outside);
      if (d.room !== from.room || blocked.has(k) || steps < 1) continue;
      visited.add(k);
      walk(d.outside, steps - 1);
      visited.delete(k);
    }
  } else {
    visited.add(key(from));
    walk(from, steps);
  }
  return [...found.values()];
}
