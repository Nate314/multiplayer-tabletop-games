import type { Die, DieChoice } from '../types.ts';

// How a move's dice are shown on its destination, e.g. '4', '2+3' or '+20'
export function dieLabel(die: DieChoice, steps: number, dice: Die[]): string {
  if (die === 'sum') return dice.map(({ value }) => value).join('+');
  if (die === 'bonus') return `+${steps}`;
  return `${steps}`;
}
