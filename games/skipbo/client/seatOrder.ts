import type { Seat } from '../types.ts';

// Every seat in turn order, starting with `first` when it is seated
export function seatOrder(seats: Seat[], first: Seat | null): Seat[] {
  const sorted = [...seats].sort((a, b) => a - b);
  if (first === null || !sorted.includes(first)) return sorted;
  const at = sorted.indexOf(first);
  return [...sorted.slice(at), ...sorted.slice(0, at)];
}
