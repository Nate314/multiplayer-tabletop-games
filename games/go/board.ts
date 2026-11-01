import type { Board, BoardSize, Point, Stone } from './types.ts';

const COLUMNS = 'ABCDEFGHJKLMNOPQRST';

export function emptyBoard(size: number): Board {
  return Array.from({ length: size }, () => Array<Stone | null>(size).fill(null));
}

export function isOnBoard(point: Point, size: number): boolean {
  const { row, col } = point;
  return (
    Number.isInteger(row) && Number.isInteger(col) && row >= 0 && col >= 0 && row < size && col < size
  );
}

export function neighbors(point: Point, size: number): Point[] {
  const { row, col } = point;
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 }
  ].filter((p) => isOnBoard(p, size));
}

const keyOf = (p: Point) => `${p.row},${p.col}`;

// The connected same-color stones at a point; empty for an empty point
export function chainAt(board: Board, point: Point): Point[] {
  const color = board[point.row]?.[point.col];
  if (!color) return [];
  const chain: Point[] = [];
  const seen = new Set([keyOf(point)]);
  const stack = [point];
  while (stack.length > 0) {
    const current = stack.pop()!;
    chain.push(current);
    for (const next of neighbors(current, board.length)) {
      if (board[next.row][next.col] !== color || seen.has(keyOf(next))) continue;
      seen.add(keyOf(next));
      stack.push(next);
    }
  }
  return chain;
}

export function libertyCount(board: Board, chain: Point[]): number {
  const liberties = new Set<string>();
  for (const stone of chain) {
    for (const next of neighbors(stone, board.length)) {
      if (board[next.row][next.col] === null) liberties.add(keyOf(next));
    }
  }
  return liberties.size;
}

// Captures come before the suicide check, so a move that takes the last liberty of an enemy chain is legal
export function playStone(
  board: Board,
  point: Point,
  stone: Stone
): { board: Board; captured: Point[] } | { error: string } {
  const size = board.length;
  if (!isOnBoard(point, size)) return { error: 'Invalid move' };
  if (board[point.row][point.col] !== null) return { error: 'That point is taken' };
  const next = board.map((row) => [...row]);
  next[point.row][point.col] = stone;
  const captured: Point[] = [];
  for (const neighbor of neighbors(point, size)) {
    const color = next[neighbor.row][neighbor.col];
    if (color === null || color === stone) continue;
    const chain = chainAt(next, neighbor);
    if (libertyCount(next, chain) > 0) continue;
    for (const p of chain) {
      next[p.row][p.col] = null;
      captured.push(p);
    }
  }
  if (libertyCount(next, chainAt(next, point)) === 0) return { error: 'That would be suicide' };
  return { board: next, captured };
}

export function boardKey(board: Board): string {
  return board.map((row) => row.map((s) => (s === 'black' ? 'b' : s === 'white' ? 'w' : '.')).join('')).join('');
}

export function starPoints(size: BoardSize): Point[] {
  if (size === 19) {
    const lines = [3, 9, 15];
    return lines.flatMap((row) => lines.map((col) => ({ row, col })));
  }
  const edge = size === 9 ? 2 : 3;
  const far = size - 1 - edge;
  const mid = (size - 1) / 2;
  return [
    { row: edge, col: edge },
    { row: edge, col: far },
    { row: far, col: edge },
    { row: far, col: far },
    { row: mid, col: mid }
  ];
}

export function pointName(point: Point, size: number): string {
  return `${COLUMNS[point.col]}${size - point.row}`;
}
