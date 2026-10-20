import type { Random } from './types.ts';

// One die of `faces` sides; `random` is in [0, 1), so every face is equally likely
export function rollDie(random: Random, faces = 6): number {
  return 1 + Math.floor(random() * faces);
}

export function rollDice(count: number, random: Random, faces = 6): number[] {
  return Array.from({ length: count }, () => rollDie(random, faces));
}
