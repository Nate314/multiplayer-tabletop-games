// The piece a player is holding and where it previews, as pure steps for the board, tray and keys
import { PIECES, SYMMETRY, orientations, sameShape, transformed, type BoardKind, type Cell } from '../geometry.ts';

export type Spot = { dx: number; dy: number };
export type Draft = { piece: number; orientation: number; spot: Spot | null };

const sameSpot = (a: Spot | null, b: Spot) => a !== null && a.dx === b.dx && a.dy === b.dy;

const shapesOf = (kind: BoardKind, piece: number) => orientations(kind, PIECES[kind][piece]);

// The orientation index that `steps` applications of one symmetry give
function step(kind: BoardKind, draft: Draft, how: 'rotate' | 'mirror', steps: number): Draft {
  const shapes = shapesOf(kind, draft.piece);
  let shape = shapes[draft.orientation];
  for (let i = 0; i < steps; i++) shape = transformed(kind, shape, how);
  return { ...draft, orientation: shapes.findIndex(s => sameShape(s, shape)) };
}

export const turn = (kind: BoardKind, draft: Draft, by: 1 | -1): Draft =>
  step(kind, draft, 'rotate', by === 1 ? 1 : SYMMETRY[kind].turns - 1);

export const flip = (kind: BoardKind, draft: Draft): Draft => step(kind, draft, 'mirror', 1);

// A legal spot that is not the previewed one previews it; the previewed one again places; an illegal one clears
export function tapSpot(draft: Draft, spot: Spot, legal: Spot[]): { draft: Draft; place: boolean } {
  if (!legal.some(s => sameSpot(s, spot))) return { draft: { ...draft, spot: null }, place: false };
  if (sameSpot(draft.spot, spot)) return { draft, place: true };
  return { draft: { ...draft, spot }, place: false };
}

export const keepSpot = (draft: Draft, legal: Spot[]): Draft =>
  legal.some(s => sameSpot(draft.spot, s)) ? draft : { ...draft, spot: null };

// The spot a pointer on `cell` means: the legal spot outlined there (its first cell lands on it), else the
// preview if it covers the cell, else any legal spot covering it
export function spotAt(shape: Cell[], cell: Cell, draft: Draft, legal: Spot[]): Spot | null {
  const covers = (s: Spot) => shape.some(([x, y, t]) => x + s.dx === cell[0] && y + s.dy === cell[1] && t === cell[2]);
  const [x, y, t] = shape[0];
  const outlined = legal.find(s => t === cell[2] && s.dx === cell[0] - x && s.dy === cell[1] - y);
  return outlined ?? (draft.spot && covers(draft.spot) ? draft.spot : legal.find(covers) ?? null);
}

// The cell a spot's outline sits on: where the shape's first cell lands
export const anchorOf = (shape: Cell[], { dx, dy }: Spot): Cell => [shape[0][0] + dx, shape[0][1] + dy, shape[0][2]];
