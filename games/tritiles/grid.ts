// The triangle grid. Pure functions only; rules and UI build on this.
//
// Coordinates: lattice points (i, j), with row j running down the screen and point (i, j) drawn at
// (i - j / 2, j * h), h = sqrt(3) / 2. Each rhombus (x,y) (x+1,y) (x+1,y+1) (x,y+1) splits into two cells:
//   up   {x, y, up: true}:  apex (x,y), then (x+1,y+1) bottom right, then (x,y+1) bottom left
//   down {x, y, up: false}: (x,y) top left, then (x+1,y) top right, then (x+1,y+1) bottom
// Those are the vertex orders, clockwise on screen; corners[k] sits on verticesOf(cell)[k].
import { TILES } from './tiles.ts';

export type Cell = { x: number; y: number; up: boolean };
export type Placed = { tile: number; cell: Cell; corners: [number, number, number] };
export type Board = Placed[];
type Corners = [number, number, number];

const point = (i: number, j: number) => `${i},${j}`;
export const cellKey = ({ x, y, up }: Cell) => `${x},${y},${up ? 'u' : 'd'}`;

export function verticesOf({ x, y, up }: Cell): [string, string, string] {
  return up
    ? [point(x, y), point(x + 1, y + 1), point(x, y + 1)]
    : [point(x, y), point(x + 1, y), point(x + 1, y + 1)];
}

export function edgeNeighbours({ x, y, up }: Cell): Cell[] {
  return up
    ? [{ x, y, up: false }, { x, y: y + 1, up: false }, { x: x - 1, y, up: false }]
    : [{ x, y, up: true }, { x, y: y - 1, up: true }, { x: x + 1, y, up: true }];
}

// The six cells around a lattice point (the inverse of verticesOf)
function cellsAround(vertex: string): Cell[] {
  const [i, j] = vertex.split(',').map(Number);
  return [
    { x: i, y: j, up: true }, { x: i - 1, y: j - 1, up: true }, { x: i, y: j - 1, up: true },
    { x: i, y: j, up: false }, { x: i - 1, y: j, up: false }, { x: i - 1, y: j - 1, up: false }
  ];
}

export function pointNeighbours(cell: Cell): Cell[] {
  const skip = new Set([cell, ...edgeNeighbours(cell)].map(cellKey));
  const found = new Map<string, Cell>();
  for (const v of verticesOf(cell)) for (const other of cellsAround(v)) if (!skip.has(cellKey(other))) found.set(cellKey(other), other);
  return [...found.values()];
}

export function rotations(tile: number): Corners[] {
  const [a, b, c] = TILES[tile];
  const all: Corners[] = [[a, b, c], [b, c, a], [c, a, b]];
  return all.filter((r, i) => all.findIndex(s => s.join() === r.join()) === i);
}

const occupied = (board: Board) => new Set(board.map(p => cellKey(p.cell)));

function numbered(board: Board): Map<string, number> {
  const numbers = new Map<string, number>();
  for (const { cell, corners } of board) verticesOf(cell).forEach((v, k) => numbers.set(v, corners[k]));
  return numbers;
}

const edgeContacts = (board: Board, cell: Cell) => {
  const filled = occupied(board);
  return edgeNeighbours(cell).filter(n => filled.has(cellKey(n)));
};

export function fits(board: Board, cell: Cell, corners: Corners): boolean {
  if (board.length === 0) return true;
  if (occupied(board).has(cellKey(cell)) || edgeContacts(board, cell).length === 0) return false;
  const numbers = numbered(board);
  return verticesOf(cell).every((v, k) => !numbers.has(v) || numbers.get(v) === corners[k]);
}

export function openPlacements(board: Board, tile: number): { cell: Cell; corners: Corners }[] {
  if (board.length === 0) return rotations(tile).map(corners => ({ cell: { x: 0, y: 0, up: true }, corners }));
  const candidates = new Map<string, Cell>();
  for (const { cell } of board) for (const n of edgeNeighbours(cell)) candidates.set(cellKey(n), n);
  return [...candidates.values()].flatMap(cell =>
    rotations(tile).filter(corners => fits(board, cell, corners)).map(corners => ({ cell, corners })));
}

export function hexagonsCompleted(board: Board, cell: Cell): number {
  const filled = occupied(board).add(cellKey(cell));
  return verticesOf(cell).filter(v => cellsAround(v).every(c => filled.has(cellKey(c)))).length;
}

export function isBridge(board: Board, cell: Cell): boolean {
  const contacts = edgeContacts(board, cell);
  if (contacts.length !== 1) return false;
  const edge = new Set(verticesOf(contacts[0]));
  const opposite = verticesOf(cell).find(v => !edge.has(v))!;
  // Only one placed cell shares an edge, and it does not hold the opposite vertex, so any tile numbering it is point-only
  return numbered(board).has(opposite);
}
