// The 1860 Checkered board as data, square for square from the public domain scan on Wikimedia Commons
// (File:CheckeredGameofLife.jpg). Row 0 is the top; pieces stand on the light squares only.
import type { Cell } from './types.ts';

export type Square = { name: string; points?: number; sendTo?: string; loseTurn?: true; despair?: true; goal?: true; speculation?: true };

export const GOAL_POINTS = 50;
export const WIN_POINTS = 100;

// Key `${row},${col}`; the scan names all 32 light squares
export const SQUARES: Readonly<Record<string, Square>> = {
  '0,1': { name: 'Wealth', points: 10 }, '0,3': { name: 'Matrimony' }, '0,5': { name: 'Gambling', sendTo: 'Ruin' },
  '0,7': { name: 'Happy Old Age', goal: true },
  '1,0': { name: 'Perseverance', sendTo: 'Success' }, '1,2': { name: 'Truth' }, '1,4': { name: 'Politics', sendTo: 'Congress' },
  '1,6': { name: 'Intemperance', sendTo: 'Poverty' },
  '2,1': { name: 'Crime', sendTo: 'Prison' }, '2,3': { name: 'Happiness', points: 5 }, '2,5': { name: 'Idleness', sendTo: 'Disgrace' },
  '2,7': { name: 'Success', points: 5 },
  '3,0': { name: 'Congress', points: 5 }, '3,2': { name: 'Honor', points: 5 }, '3,4': { name: 'Cupid', sendTo: 'Matrimony' },
  '3,6': { name: 'Speculation', speculation: true },
  '4,1': { name: 'Honesty', sendTo: 'Happiness' }, '4,3': { name: 'Industry', sendTo: 'Wealth' }, '4,5': { name: 'Bravery', sendTo: 'Honor' },
  '4,7': { name: 'Ruin' },
  '5,0': { name: 'Poverty' }, '5,2': { name: 'Ambition', sendTo: 'Fame' }, '5,4': { name: 'College', points: 5 },
  '5,6': { name: 'Despair', despair: true },
  '6,1': { name: 'School', sendTo: 'College' }, '6,3': { name: 'Influence', sendTo: 'Fat Office' }, '6,5': { name: 'Fame' },
  '6,7': { name: 'Fat Office', points: 5 },
  '7,0': { name: 'Infancy' }, '7,2': { name: 'Disgrace' }, '7,4': { name: 'Jail' }, '7,6': { name: 'Prison', loseTurn: true }
};

export const INFANCY: Cell = { row: 7, col: 0 };
export const HAPPY_OLD_AGE: Cell = { row: 0, col: 7 };

export const isLight = (cell: Cell): boolean => (cell.row + cell.col) % 2 !== 0;

export function cellOf(name: string): Cell {
  const key = Object.keys(SQUARES).find(k => SQUARES[k].name === name);
  if (!key) throw new Error(`No square named ${name}`);
  const [row, col] = key.split(',').map(Number);
  return { row, col };
}

// One step to the next light square: two rows, two columns, or one diagonal
const STEPS: Record<'upDown' | 'leftRight' | 'diagonal', [number, number][]> = {
  upDown: [[-2, 0], [2, 0]], leftRight: [[0, -2], [0, 2]], diagonal: [[-1, -1], [-1, 1], [1, -1], [1, 1]]
};
const TEETOTUM = ['upDown', 'leftRight', 'diagonal'] as const;

// Spins 1 to 3 move one step; 4 to 6 the same directions, one or two steps
export function legalMoves(from: Cell, spin: number): Cell[] {
  const counts = spin > 3 ? [1, 2] : [1];
  return STEPS[TEETOTUM[(spin - 1) % 3]]
    .flatMap(([dr, dc]) => counts.map(n => ({ row: from.row + dr * n, col: from.col + dc * n })))
    .filter(c => c.row >= 0 && c.row < 8 && c.col >= 0 && c.col < 8);
}
