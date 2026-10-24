import type { Seat } from './types.ts';

// The viewer's own hand; the table view (viewer null) and a seat with no hand see none
export function viewHand<T>(hands: Partial<Record<Seat, T[]>>, viewer: Seat | null): T[] {
  return viewer === null ? [] : hands[viewer] ?? [];
}

// How many cards each seat holds, which everyone may see
export function handCounts<T>(hands: Partial<Record<Seat, T[]>>): Record<Seat, number> {
  return mapSeats(hands, hand => hand.length);
}

export function mapSeats<T, U>(record: Partial<Record<Seat, T>>, fn: (value: T, seat: Seat) => U): Record<Seat, U> {
  return Object.fromEntries(Object.entries(record).map(([seat, value]) => [seat, fn(value as T, Number(seat))]));
}
