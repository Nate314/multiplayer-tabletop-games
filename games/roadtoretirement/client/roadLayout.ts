// Where each ROAD space is drawn: rows that wind back and forth, each pair of branches as two lanes side by side
import { MID_FORK, ROAD, START_FORK } from '../road.ts';

export const SPACE_RADIUS = 13;
const COLUMNS = 22; // most spaces in one row
const SLOT = 30;
const MARGIN = 20;
const MARGIN_Y = 40;
const MARGIN_TOP = 58; // room above the first row for the tokens on Start, up to three rows of two
const ROW_PITCH = 64;
const LANE = 16; // each lane's distance from the row's middle

export type Point = { x: number; y: number };
type Block = number | [number[], number[]]; // one space, or two branches drawn as lanes

const range = (from: number, to: number): number[] => Array.from({ length: to - from }, (_, i) => from + i);
const widthOf = (block: Block): number => (typeof block === 'number' ? 1 : Math.max(block[0].length, block[1].length));

const shared1 = ROAD[START_FORK.work - 1].next[0];
const shared2 = ROAD[MID_FORK.fast - 1].next[0];
const BLOCKS: Block[] = [
  0, [range(START_FORK.college, START_FORK.work), range(START_FORK.work, shared1)],
  ...range(shared1, MID_FORK.space), MID_FORK.space, [range(MID_FORK.safe, MID_FORK.fast), range(MID_FORK.fast, shared2)],
  ...range(shared2, ROAD.length)
];

// A pair of lanes shares its row with the space before it and the one after it, so the split and the join are drawn level
function rows(): Block[][] {
  const result: Block[][] = [[]];
  let used = 0;
  BLOCKS.forEach((block, i) => {
    const next = BLOCKS[i + 1];
    const need = typeof block === 'number' && next !== undefined && typeof next !== 'number' ? widthOf(next) + 2 : widthOf(block);
    if (need > COLUMNS) throw new Error('A branch is too long for one row');
    const placed = typeof BLOCKS[i - 1] !== 'number' && i > 0; // the space after a pair of lanes always fits
    if (!placed && used + need > COLUMNS) [result[result.length], used] = [[], 0];
    result.at(-1)!.push(block);
    used += widthOf(block);
  });
  return result;
}

const ROWS = rows();
export const BOARD_WIDTH = COLUMNS * SLOT + 2 * MARGIN;
export const BOARD_HEIGHT = MARGIN_TOP + MARGIN_Y + (ROWS.length - 1) * ROW_PITCH;

function horizontal(): Point[] {
  const points: Point[] = [];
  ROWS.forEach((row, r) => {
    const slot = (BOARD_WIDTH - 2 * MARGIN) / row.reduce<number>((sum, block) => sum + widthOf(block), 0);
    const y = MARGIN_TOP + r * ROW_PITCH;
    const x = (at: number) => (r % 2 === 0 ? MARGIN + (at + 0.5) * slot : BOARD_WIDTH - MARGIN - (at + 0.5) * slot);
    let at = 0;
    for (const block of row) {
      if (typeof block === 'number') points[block] = { x: x(at), y };
      else {
        const span = widthOf(block) - 1;
        block.forEach((lane, side) => lane.forEach((space, i) => {
          points[space] = { x: x(at + (lane.length === 1 ? span / 2 : (i * span) / (lane.length - 1))), y: y + (side === 0 ? -LANE : LANE) };
        }));
      }
      at += widthOf(block);
    }
  });
  return points;
}

const HORIZONTAL = horizontal();
const VERTICAL = HORIZONTAL.map(({ x, y }) => ({ x: y, y: x }));

// Vertical swaps the axes, for a narrow window: the rows become columns
export const roadLayout = (vertical: boolean): Point[] => (vertical ? VERTICAL : HORIZONTAL);

export const TOKEN_RADIUS = 6.5;
const TOKEN_PITCH = 2 * TOKEN_RADIUS + 0.5;
const TOKEN_OFFSET = SPACE_RADIUS + TOKEN_RADIUS + 1.5; // clear of the space's circle, so its label stays readable

// Where a fork splits or joins, the upper lanes sit beside the space, so its tokens stack in short rows
const FORK_ENDS = [0, shared1, MID_FORK.space, shared2];

// The `index`th of `count` tokens on a space: a line beside the space, above it (left of it when vertical), or below it
// (right) on a branch's lower lane, so a token never covers a space's label or another token on the same space
export function tokenSpot(space: number, index: number, count: number, vertical: boolean): Point {
  const { x, y } = HORIZONTAL[space];
  const side = (y - MARGIN_TOP) % ROW_PITCH === LANE ? 1 : -1;
  const perRow = FORK_ENDS.includes(space) ? (vertical ? 3 : 2) : 6;
  const row = Math.floor(index / perRow);
  const half = ((Math.min(perRow, count - row * perRow) - 1) / 2) * TOKEN_PITCH;
  const middle = Math.min(Math.max(x, half + TOKEN_RADIUS), BOARD_WIDTH - half - TOKEN_RADIUS); // a row near an edge moves in
  const spot = { x: middle - half + (index % perRow) * TOKEN_PITCH, y: y + side * (TOKEN_OFFSET + row * TOKEN_PITCH) };
  return vertical ? { x: spot.y, y: spot.x } : spot;
}
