// Building a turn's path click by click: the marble, then each landing
import { holeKey } from '../board.ts';
import { isStep, nextLandings } from '../rules.ts';
import type { Hole, PublicGameState, Seat } from '../types.ts';

// A path belongs to the state it was built on, so an undo or a dismissal drops it
export type Picked = { moveCount: number; path: Hole[] };

export function pathFor(picked: Picked, moveCount: number): Hole[] {
  return picked.moveCount === moveCount ? picked.path : [];
}

const sameHole = (a: Hole, b: Hole): boolean => a.q === b.q && a.r === b.r;

export function includesHole(holes: Hole[], hole: Hole): boolean {
  return holes.some(other => sameHole(other, hole));
}

// The path after clicking `hole`, and whether it is a whole move to send now
export function pickHole(state: PublicGameState, seat: Seat, path: Hole[], hole: Hole): { path: Hole[]; send: boolean } {
  if (state.holes[holeKey(hole)] === seat && nextLandings(state, [hole]).length > 0) {
    const again = path.length === 1 && sameHole(path[0], hole);
    return { path: again ? [] : [hole], send: false };
  }
  if (path.length > 0 && includesHole(nextLandings(state, path), hole)) {
    const next = [...path, hole];
    return { path: next, send: isStep(next) || nextLandings(state, next).length === 0 };
  }
  return { path, send: false };
}
