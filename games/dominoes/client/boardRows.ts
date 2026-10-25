// The board as rows of tiles, so a long branch wraps on a phone and never runs into another. The hub row is the line through
// the starter; the top arm or the first half of the trains sit above it, the rest below, and each double's branches get a row
// of their own right after the row holding the double.
import { endLabel, lineOf, openEnd } from '../board.ts';
import type { Board } from '../board.ts';
import type { Seat } from '../types.ts';

export type Cell =
  | { kind: 'tile'; tile: number; pips: [number, number] }
  | { kind: 'end'; arm: number; pips: number };
export type Row = { key: string; label: string | null; place: 'above' | 'hub' | 'below'; depth: number; open: boolean; cells: Cell[] };

// The arms of one chain: the first, then each double's forward child, which is the first arm grown from it
function chainArms(board: Board, first: number): number[] {
  const arms = [first];
  for (;;) {
    const { tiles } = board.arms[arms[arms.length - 1]];
    const last = tiles[tiles.length - 1];
    if (!last || last.inner !== last.outer) return arms;
    arms.push(board.arms.findIndex(arm => arm.from === last.tile));
  }
}

const endCell = (board: Board, arms: number[]): Cell[] => {
  const arm = arms[arms.length - 1];
  const pips = openEnd(board, arm);
  return pips === null ? [] : [{ kind: 'end', arm, pips }];
};

// The branches of every double in `arms`, first then second: the arms grown from it after its forward child
// (arms are append-only, so they are in that order)
const branchesOf = (board: Board, arms: number[]): number[] =>
  arms.flatMap(arm => board.arms[arm].tiles
    .filter(laid => laid.inner === laid.outer)
    .flatMap(laid => board.arms.flatMap((child, i) => (child.from === laid.tile ? [i] : [])).slice(1)));

export function boardRows(board: Board, playerNames: Record<Seat, string>, openTrains: Seat[]): Row[] {
  const { start } = board;
  if (!start) return [];

  // One arm's chain as a row, then the rows of its doubles' branches
  const rows = (first: number, place: Row['place'], depth: number): Row[] => {
    const arms = chainArms(board, first);
    const { owner, name } = board.arms[first];
    const cells: Cell[] = [
      ...arms.flatMap(arm => board.arms[arm].tiles.map((laid): Cell => ({ kind: 'tile', tile: laid.tile, pips: [laid.inner, laid.outer] }))),
      ...endCell(board, arms)
    ];
    const open = name.kind === 'train' && typeof owner === 'number' && openTrains.includes(owner);
    const row: Row = { key: `arm-${first}`, label: endLabel(board, first, playerNames), place, depth, open, cells };
    return [row, ...branchesOf(board, arms).flatMap(branch => rows(branch, place, depth + 1))];
  };

  // The hub row: today's line, with an end at each side that is open
  const side = (kind: 'left' | 'right') => {
    const first = board.arms.findIndex(arm => arm.name.kind === kind);
    return first < 0 ? [] : chainArms(board, first);
  };
  const [left, right] = [side('left'), side('right')];
  const hub: Row = {
    key: 'hub', label: null, place: 'hub', depth: 0, open: false,
    cells: [
      ...(left.length ? endCell(board, left) : []),
      ...lineOf(board).map((placed): Cell => ({ kind: 'tile', tile: placed.tile, pips: [placed.left, placed.right] })),
      ...(right.length ? endCell(board, right) : [])
    ]
  };

  // The arms that grow straight from the starter, other than its left and right: a spinner's top and bottom, or the trains
  const outward = board.arms.flatMap((arm, i) =>
    arm.from === start.tile && (arm.name.kind === 'top' || arm.name.kind === 'bottom' || arm.name.kind === 'train') ? [i] : []);
  const trains = outward.filter(arm => board.arms[arm].name.kind === 'train')
    .sort((a, b) => Number(board.arms[a].owner === 'mexican') - Number(board.arms[b].owner === 'mexican'));
  const above = trains.length ? trains.slice(0, Math.ceil(trains.length / 2)) : outward.filter(arm => board.arms[arm].name.kind === 'top');
  const below = trains.length ? trains.slice(above.length) : outward.filter(arm => board.arms[arm].name.kind === 'bottom');

  return [
    ...above.flatMap(arm => rows(arm, 'above', 0)),
    hub,
    ...branchesOf(board, [...left, ...right]).flatMap(branch => rows(branch, 'below', 1)),
    ...below.flatMap(arm => rows(arm, 'below', 0))
  ];
}
