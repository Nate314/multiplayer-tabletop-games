import { shuffle } from '../../shared/shuffle.ts';
import type { Random } from '../../shared/types.ts';
import type { Card, Pattern } from './types.ts';

const FREE = 12;
const LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;
const LINES = [
  ...[0, 1, 2, 3, 4].map(row => [0, 1, 2, 3, 4].map(col => row * 5 + col)),
  ...[0, 1, 2, 3, 4].map(col => [0, 1, 2, 3, 4].map(row => row * 5 + col)),
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20]
];
const CORNERS = [0, 4, 20, 24];

export function dealCard(random: Random): Card {
  const card: Card = new Array(25).fill(0);
  for (let col = 0; col < 5; col++) {
    const range = Array.from({ length: 15 }, (_, i) => col * 15 + i + 1);
    shuffle(range, random).slice(0, 5).forEach((n, row) => { card[row * 5 + col] = n; });
  }
  card[FREE] = 0;
  return card;
}

export function letterOf(n: number): 'B' | 'I' | 'N' | 'G' | 'O' {
  return LETTERS[Math.floor((n - 1) / 15)];
}

// The free center counts as marked
export function hasPattern(card: Card, marked: readonly number[], pattern: Pattern): boolean {
  const has = (index: number) => index === FREE || marked.includes(index);
  if (pattern === 'corners') return CORNERS.every(has);
  if (pattern === 'blackout') return card.every((_, index) => has(index));
  return LINES.some(line => line.every(has));
}

// The squares whose number has been called
export function markable(card: Card, called: readonly number[]): number[] {
  return card.flatMap((n, index) => (index !== FREE && called.includes(n) ? [index] : []));
}
