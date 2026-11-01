// Test-only helpers shared by the view and manager tests
import type { Ship } from './types.ts';

// Every object anywhere in the value with both `length` and `orientation` keys: each ship a view carries
export function shipsIn(value: unknown): Ship[] {
  if (Array.isArray(value)) return value.flatMap(shipsIn);
  if (typeof value !== 'object' || value === null) return [];
  if ('length' in value && 'orientation' in value) return [value as Ship];
  return Object.values(value).flatMap(shipsIn);
}
