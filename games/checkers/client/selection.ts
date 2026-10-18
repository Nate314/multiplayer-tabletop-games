import { isSamePosition } from '../rules.ts';
import type { Position } from '../types.ts';

export function includesPosition(squares: Position[], square: Position): boolean {
  return squares.some(other => isSamePosition(other, square));
}

function startsWith(path: Position[], prefix: Position[]): boolean {
  return prefix.every((square, index) => index < path.length && isSamePosition(path[index], square));
}

// The squares that can be clicked after the ones picked so far: the next square of every legal move that starts the same way
export function nextSquares(legal: Position[][], picked: Position[]): Position[] {
  const squares: Position[] = [];
  for (const path of legal) {
    const next = path[picked.length];
    if (next && startsWith(path, picked) && !includesPosition(squares, next)) squares.push(next);
  }
  return squares;
}

// Whether the picked squares are a whole legal move, ready to send
export function isCompleteMove(legal: Position[][], picked: Position[]): boolean {
  return legal.some(path => path.length === picked.length && startsWith(path, picked));
}
