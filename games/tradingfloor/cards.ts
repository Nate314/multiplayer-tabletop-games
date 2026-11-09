// The deck, the deal, offer checks and corners of Trading Floor
import { shuffle } from '../../shared/shuffle.ts';
import type { Random } from '../../shared/types.ts';
import type { Card, Commodity, Corner, Seat } from './types.ts';

// In deal order: a table of n players uses the first n
export const COMMODITIES: { kind: Commodity; name: string; value: number }[] = [
  { kind: 'saffron', name: 'Saffron', value: 100 },
  { kind: 'silver', name: 'Silver', value: 85 },
  { kind: 'coffee', name: 'Coffee', value: 80 },
  { kind: 'cocoa', name: 'Cocoa', value: 75 },
  { kind: 'copper', name: 'Copper', value: 70 },
  { kind: 'sugar', name: 'Sugar', value: 60 },
  { kind: 'cotton', name: 'Cotton', value: 55 },
  { kind: 'soy', name: 'Soy', value: 50 }
];
export const CARDS_EACH = 9;
export const BULL_BEAR_PENALTY = 20;
const MAX_OFFER = 4;

// Deals one card at a time, starting at the round's dealer side, so with Bull and Bear the first two seats get 10
export function deal(seats: Seat[], round: number, bullBear: boolean, random: Random): Partial<Record<Seat, Card[]>> {
  const kinds: Card['kind'][] = COMMODITIES.slice(0, seats.length).flatMap(c => Array<Card['kind']>(CARDS_EACH).fill(c.kind));
  if (bullBear) kinds.push('bull', 'bear');
  const deck = shuffle(kinds.map((kind, id) => ({ id, kind })), random);
  const hands: Partial<Record<Seat, Card[]>> = Object.fromEntries(seats.map(seat => [seat, []]));
  deck.forEach((card, i) => hands[seats[((round - 1) + i) % seats.length]]!.push(card));
  return hands;
}

export function offerError(hand: Card[], cardIds: unknown): string | null {
  if (!Array.isArray(cardIds) || cardIds.length < 1 || cardIds.length > MAX_OFFER
    || !cardIds.every(id => Number.isInteger(id)) || new Set(cardIds).size !== cardIds.length) return 'Offer 1 to 4 cards';
  const picked = cardIds.map(id => hand.find(card => card.id === id));
  if (picked.some(card => !card)) return 'Those are not your cards';
  const kinds = new Set(picked.map(card => card!.kind).filter(kind => kind !== 'bull' && kind !== 'bear'));
  return kinds.size > 1 ? 'Offer cards of one commodity' : null;
}

export function cornerOf(hand: Card[]): Corner | null {
  if (hand.some(card => card.kind === 'bear')) return null;
  const bull = hand.some(card => card.kind === 'bull');
  for (const { kind, value } of COMMODITIES) {
    const count = hand.filter(card => card.kind === kind).length;
    if (count === CARDS_EACH) return { commodity: kind, points: bull ? value * 2 : value, double: bull };
    if (count === CARDS_EACH - 1 && bull) return { commodity: kind, points: value, double: false };
  }
  return null;
}
