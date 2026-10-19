import type { Random } from './types.ts';

// Fisher-Yates over `random`; returns a new array and leaves `items` alone
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Shuffles each pile of a record on its own, such as one deck per level or one pile per seat
export function shuffleEach<K extends PropertyKey, T>(piles: Record<K, T[]>, random: Random): Record<K, T[]> {
  return Object.fromEntries(Object.entries<T[]>(piles).map(([key, pile]) => [key, shuffle(pile, random)])) as Record<K, T[]>;
}
