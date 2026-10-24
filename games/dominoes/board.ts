// The board as a set of arms growing from a starter tile, so one model serves a single line, a spinner,
// Chickenfoot and Mexican Train. Pure functions only; rules and UI build on this.
import type { Placed, Seat } from './types.ts';

export type Branching = 'none' | 'starter' | 'every';
export type Layout = { branching: Branching; chickenfoot: boolean; trains: boolean };
export const SINGLE_LINE: Layout = { branching: 'none', chickenfoot: false, trains: false };

export type Laid = { tile: number; inner: number; outer: number }; // inner touches the arm's base side
export type ArmName =
  | { kind: 'left' | 'right' | 'top' | 'bottom' | 'train' }
  | { kind: 'branch'; index: 1 | 2; pips: number }; // pips: the double it grows from
export type Owner = Seat | 'mexican' | null; // null unless Trains is on
export type Arm = {
  from: number | null; // tile id of the starter or double it grows from; null for the two arms of a non-double starter
  base: number; // the pips its first tile must match
  name: ArmName; // a forward child inherits its parent's name
  owner: Owner; // every child inherits its parent's owner
  tiles: Laid[]; // outward
};
export type Board = { start: Placed | null; arms: Arm[] }; // arms are append-only: an arm's index is its id on the wire
export const EMPTY_BOARD: Board = { start: null, arms: [] };

const lastIndexWhere = <T>(items: T[], test: (item: T) => boolean) =>
  items.reduce((found, item, i) => (test(item) ? i : found), -1);
const isDouble = (pips: [number, number]) => pips[0] === pips[1];
const newArm = (from: number | null, base: number, name: ArmName, owner: Owner): Arm =>
  ({ from, base, name, owner, tiles: [] });

export function openEnd(board: Board, arm: number): number | null {
  const found = board.arms[arm];
  if (!found) return null;
  const last = found.tiles[found.tiles.length - 1];
  if (!last) return found.base;
  return last.inner === last.outer ? null : last.outer;
}

export function openEnds(board: Board): { arm: number; pips: number }[] {
  const ends: { arm: number; pips: number }[] = [];
  board.arms.forEach((_, arm) => {
    const pips = openEnd(board, arm);
    if (pips !== null) ends.push({ arm, pips });
  });
  return ends;
}

export const branched = (board: Board) =>
  board.arms.some(arm => arm.name.kind !== 'left' && arm.name.kind !== 'right');

function startArms(layout: Layout, tile: number, pips: [number, number], seats: Seat[]): Arm[] {
  const [low, high] = [Math.min(...pips), Math.max(...pips)];
  if (!isDouble(pips)) return [newArm(null, low, { kind: 'left' }, null), newArm(null, high, { kind: 'right' }, null)];
  if (layout.trains) {
    return [...seats, 'mexican' as const].map(owner => newArm(tile, low, { kind: 'train' }, owner));
  }
  const kinds = layout.branching === 'none' ? (['left', 'right'] as const) : (['left', 'right', 'top', 'bottom'] as const);
  return kinds.map(kind => newArm(tile, low, { kind }, null));
}

export function lay(
  board: Board, layout: Layout, tile: number, pips: [number, number], arm: number, seats: Seat[]
): { board: Board; pips: [number, number] } {
  if (!board.start) {
    const [low, high] = [Math.min(...pips), Math.max(...pips)];
    return {
      board: { start: { tile, left: low, right: high }, arms: startArms(layout, tile, pips, seats) },
      pips: [low, high]
    };
  }
  const target = board.arms[arm];
  const end = openEnd(board, arm) as number;
  const outer = pips[0] === end ? pips[1] : pips[0];
  const arms = board.arms.map((a, i) => (i === arm ? { ...a, tiles: [...a.tiles, { tile, inner: end, outer }] } : a));
  if (isDouble(pips)) {
    arms.push(newArm(tile, end, target.name, target.owner));
    if (layout.branching === 'every' || (layout.branching === 'starter' && !branched(board))) {
      arms.push(newArm(tile, end, { kind: 'branch', index: 1, pips: end }, target.owner));
      arms.push(newArm(tile, end, { kind: 'branch', index: 2, pips: end }, target.owner));
    }
  }
  return {
    board: { start: board.start, arms },
    pips: target.name.kind === 'left' ? [outer, end] : [end, outer]
  };
}

export function pendingArms(board: Board, layout: Layout): number[] {
  if (!layout.chickenfoot) return [];
  const starter = board.start?.tile;
  const candidate = (arm: Arm) =>
    arm.tiles.length === 0 && arm.from !== null && !(layout.trains && arm.from === starter);
  const newest = lastIndexWhere(board.arms, candidate);
  if (newest < 0) return [];
  const from = board.arms[newest].from;
  return board.arms.flatMap((arm, i) => (arm.tiles.length === 0 && arm.from === from ? [i] : []));
}

// One side of the hub row: follows forward children, each of which grows from the double that ends the arm before it
function chain(board: Board, first: Arm | undefined): Laid[] {
  const laid: Laid[] = [];
  for (let arm = first; arm; ) {
    laid.push(...arm.tiles);
    const last = arm.tiles[arm.tiles.length - 1];
    const double = last && last.inner === last.outer ? last.tile : null;
    arm = double === null ? undefined : board.arms.find(a => a.from === double);
  }
  return laid;
}

export function lineOf(board: Board): Placed[] {
  if (!board.start) return [];
  const left = chain(board, board.arms.find(arm => arm.name.kind === 'left'))
    .map(({ tile, inner, outer }): Placed => ({ tile, left: outer, right: inner }))
    .reverse();
  const right = chain(board, board.arms.find(arm => arm.name.kind === 'right'))
    .map(({ tile, inner, outer }): Placed => ({ tile, left: inner, right: outer }));
  return [...left, board.start, ...right];
}

export function boardFromLine(line: Placed[]): Board {
  if (line.length === 0) return EMPTY_BOARD;
  const [first, ...rest] = line;
  const hub = lay(EMPTY_BOARD, SINGLE_LINE, first.tile, [first.left, first.right], 0, []).board;
  // Keep the saved orientation of the starter, which may read high-low
  const seeded: Board = {
    start: first,
    arms: hub.arms.map((arm, i) => ({ ...arm, base: i === 0 ? first.left : first.right }))
  };
  return rest.reduce((board, placed) => {
    const arm = lastIndexWhere(board.arms, a => a.name.kind === 'right');
    return lay(board, SINGLE_LINE, placed.tile, [placed.left, placed.right], arm, []).board;
  }, seeded);
}

export const boardOf = (state: { board?: Board; line?: Placed[] }): Board =>
  state.board ?? boardFromLine(state.line ?? []);

const ordinal = (index: 1 | 2) => (index === 1 ? 'First' : 'Second');

function describe(board: Board, arm: number, playerNames: Record<Seat, string>) {
  const { name, owner } = board.arms[arm];
  if (name.kind === 'branch') {
    const of = `branch of ${name.pips}-${name.pips}`;
    return { label: `${ordinal(name.index)} ${of}`, phrase: `on the ${ordinal(name.index).toLowerCase()} ${of}` };
  }
  if (name.kind === 'train') {
    return owner === 'mexican' || owner === null
      ? { label: 'Mexican train', phrase: 'on the Mexican train' }
      : { label: `${playerNames[owner]}'s train`, phrase: `on ${playerNames[owner]}'s train` };
  }
  const side = name.kind[0].toUpperCase() + name.kind.slice(1);
  return { label: `${side} end`, phrase: `on the ${name.kind}` };
}

export const endLabel = (board: Board, arm: number, playerNames: Record<Seat, string>) =>
  describe(board, arm, playerNames).label;
export const endPhrase = (board: Board, arm: number, playerNames: Record<Seat, string>) =>
  describe(board, arm, playerNames).phrase;
