// Sudoku puzzle generation: server side only, never imported by the client
import { shuffle } from '../../shared/shuffle.ts';
import type { Random } from '../../shared/types.ts';
import { boxOf, CELLS, colOf, rowOf } from './grid.ts';
import type { Difficulty } from './options.ts';

export const GIVENS = { easy: 36, medium: 30 } as const;
const MAX_TRIES = 20;
const ALL = 0x3fe; // bits 1 to 9

const bit = (digit: number): number => 1 << digit;
const countBits = (mask: number): number => { let n = 0; for (let m = mask; m; m &= m - 1) n++; return n; };

type Masks = { rows: number[]; cols: number[]; boxes: number[] };

function place(masks: Masks, cell: number, digit: number): void {
  masks.rows[rowOf(cell)] |= bit(digit);
  masks.cols[colOf(cell)] |= bit(digit);
  masks.boxes[boxOf(cell)] |= bit(digit);
}

function unplace(masks: Masks, cell: number, digit: number): void {
  masks.rows[rowOf(cell)] &= ~bit(digit);
  masks.cols[colOf(cell)] &= ~bit(digit);
  masks.boxes[boxOf(cell)] &= ~bit(digit);
}

function masksOf(grid: readonly number[]): Masks {
  const masks: Masks = { rows: Array(9).fill(0), cols: Array(9).fill(0), boxes: Array(9).fill(0) };
  grid.forEach((digit, cell) => { if (digit) place(masks, cell, digit); });
  return masks;
}

const candidatesOf = (masks: Masks, cell: number): number => ALL & ~(masks.rows[rowOf(cell)] | masks.cols[colOf(cell)] | masks.boxes[boxOf(cell)]);

export function fullGrid(random: Random): number[] {
  const grid: number[] = Array(CELLS).fill(0);
  const masks = masksOf(grid);
  const fill = (cell: number): boolean => {
    if (cell === CELLS) return true;
    const candidates = candidatesOf(masks, cell);
    for (const digit of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random)) {
      if (!(candidates & bit(digit))) continue;
      grid[cell] = digit;
      place(masks, cell, digit);
      if (fill(cell + 1)) return true;
      unplace(masks, cell, digit);
      grid[cell] = 0;
    }
    return false;
  };
  fill(0);
  return grid;
}

// Counts solutions, stopping at `limit`; branches on the empty cell with the fewest candidates
export function countSolutions(grid: readonly number[], limit: number): number {
  const work = [...grid];
  const masks = masksOf(work);
  let found = 0;
  const search = (): void => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let cell = 0; cell < CELLS; cell++) {
      if (work[cell]) continue;
      const mask = candidatesOf(masks, cell);
      const count = countBits(mask);
      if (count < bestCount) { best = cell; bestMask = mask; bestCount = count; if (count <= 1) break; }
    }
    if (best < 0) { found++; return; }
    for (let digit = 1; digit <= 9 && found < limit; digit++) {
      if (!(bestMask & bit(digit))) continue;
      work[best] = digit;
      place(masks, best, digit);
      search();
      unplace(masks, best, digit);
      work[best] = 0;
    }
  };
  search();
  return found;
}

// The 27 rows, columns and boxes, each a list of cells
const UNITS: number[][] = [rowOf, colOf, boxOf].flatMap(unitOf =>
  Array.from({ length: 9 }, (_, unit) => Array.from({ length: CELLS }, (_, cell) => cell).filter(cell => unitOf(cell) === unit)));

// True when naked and hidden singles alone fill the grid
export function solvesWithSingles(grid: readonly number[]): boolean {
  const work = [...grid];
  const masks = masksOf(work);
  const set = (cell: number, digit: number): void => { work[cell] = digit; place(masks, cell, digit); };
  for (let progress = true; progress;) {
    progress = false;
    for (let cell = 0; cell < CELLS; cell++) {
      if (work[cell]) continue;
      const mask = candidatesOf(masks, cell);
      if (countBits(mask) === 1) { set(cell, Math.log2(mask)); progress = true; }
    }
    for (const unit of UNITS) {
      for (let digit = 1; digit <= 9; digit++) {
        if (unit.some(cell => work[cell] === digit)) continue;
        const spots = unit.filter(cell => !work[cell] && candidatesOf(masks, cell) & bit(digit));
        if (spots.length === 1) { set(spots[0], digit); progress = true; }
      }
    }
  }
  return work.every(Boolean);
}

// Blanks symmetric cell pairs in random order while the puzzle stays unique (and, for Easy, solvable by singles)
function carve(solution: number[], difficulty: Difficulty, random: Random): number[] {
  const givens = [...solution];
  const stopAt = difficulty === 'hard' ? 0 : GIVENS[difficulty] + 1;
  const pairs = shuffle(Array.from({ length: 41 }, (_, i) => i), random);
  for (const i of pairs) {
    if (givens.filter(Boolean).length <= stopAt) break;
    const kept = [givens[i], givens[80 - i]];
    givens[i] = 0;
    givens[80 - i] = 0;
    const ok = countSolutions(givens, 2) === 1 && (difficulty !== 'easy' || solvesWithSingles(givens));
    if (!ok) { givens[i] = kept[0]; givens[80 - i] = kept[1]; }
  }
  return givens;
}

export function generatePuzzle(difficulty: Difficulty, random: Random): { givens: number[]; solution: number[] } {
  let result = { givens: [] as number[], solution: [] as number[] };
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const solution = fullGrid(random);
    const givens = carve(solution, difficulty, random);
    result = { givens, solution };
    const count = givens.filter(Boolean).length;
    // Hard must beat Medium's givens as well as need more than singles
    const reachedTarget = difficulty === 'hard' ? !solvesWithSingles(givens) && count < GIVENS.medium : count <= GIVENS[difficulty] + 1;
    if (reachedTarget) break;
  }
  return result;
}
