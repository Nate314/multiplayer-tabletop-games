import { shuffle } from '../../shared/shuffle.ts';
import type { Random } from '../../shared/types.ts';
import { SHAPES, type ShapeId } from './shapes.ts';

export const ROTATION_STEPS = 8;
export type BoardSize = 9 | 16 | 25;

// holes[i] is the shape cut at grid cell i (row-major); tray holds the same shapes in another order, tray[i] starting turned startTurns[i]
export type Layout = { size: BoardSize; holes: ShapeId[]; tray: ShapeId[]; startTurns: number[] };

export function dealLayout(size: BoardSize, random: Random): Layout {
  const holes = shuffle(SHAPES, random).slice(0, size).map((s) => s.id);
  const tray = shuffle(holes, random);
  const startTurns = tray.map((id) => {
    const period = SHAPES.find((s) => s.id === id)!.period;
    const all = Array.from({ length: ROTATION_STEPS }, (_, t) => t);
    // A period 1 shape fits at every turn, so it may start anywhere
    const turns = period === 1 ? all : all.filter((t) => t % period !== 0);
    return turns[Math.floor(random() * turns.length)];
  });
  return { size, holes, tray, startTurns };
}

// `placed` maps a filled hole to the tray index sitting in it
export function fits(layout: Layout, placed: Partial<Record<number, number>>, trayIndex: number, hole: number, turns: number): boolean {
  if (placed[hole] !== undefined || Object.values(placed).includes(trayIndex)) return false;
  if (layout.tray[trayIndex] !== layout.holes[hole]) return false;
  return turns % SHAPES.find((s) => s.id === layout.tray[trayIndex])!.period === 0;
}

export function turnOnce(turns: number): number {
  return (turns + 1) % ROTATION_STEPS;
}
