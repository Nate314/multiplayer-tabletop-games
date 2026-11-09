import type { Color, Source } from '../types.ts';

// The tiles the player has picked up but not yet placed
export type Selection = { source: Source; color: Color };

export function sameSource(a: Source, b: Source): boolean {
  if (a.type === 'center' || b.type === 'center') return a.type === b.type;
  return a.index === b.index;
}
