import { colOf, rowOf } from '../grid.ts';

export type KeyCommand = { kind: 'digit'; digit: number } | { kind: 'erase' } | { kind: 'move'; to: number } | { kind: 'pencil' } | null;

// Row and column steps per arrow key
const STEPS: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
const clamp = (n: number) => Math.min(8, Math.max(0, n));

// What a key press does on the grid: an arrow with nothing selected starts at the top left
export function keyToCommand(key: string, selected: number | null): KeyCommand {
  if (/^[1-9]$/.test(key)) return { kind: 'digit', digit: Number(key) };
  if (key === 'Backspace' || key === 'Delete' || key === '0') return { kind: 'erase' };
  if (key === 'n' || key === 'N') return { kind: 'pencil' };
  const step = STEPS[key];
  if (!step) return null;
  if (selected === null) return { kind: 'move', to: 0 };
  return { kind: 'move', to: clamp(rowOf(selected) + step[0]) * 9 + clamp(colOf(selected) + step[1]) };
}
