// Drag ids for tiles ("factory-2-blue", "center-red") and drop targets on your own board ("line-<row>", "floor")
import { COLORS } from '../rules.ts';
import type { Selection } from './selection.ts';
import type { Color } from '../types.ts';

const LINES = 5;

export function dragId({ source, color }: Selection): string {
  return source.type === 'center' ? `center-${color}` : `factory-${source.index}-${color}`;
}

export function parseDragId(id: string): Selection | null {
  const match = /^(?:center|factory-(\d+))-(\w+)$/.exec(id);
  if (!match || !COLORS.includes(match[2] as Color)) return null;
  const color = match[2] as Color;
  return match[1] === undefined ? { source: { type: 'center' }, color } : { source: { type: 'factory', index: Number(match[1]) }, color };
}

export const lineTarget = (row: number) => `line-${row}`;

export function parseDropTarget(target: string): number | 'floor' | null {
  if (target === 'floor') return 'floor';
  const match = /^line-(\d)$/.exec(target);
  return match && Number(match[1]) < LINES ? Number(match[1]) : null;
}
