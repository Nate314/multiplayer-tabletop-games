import { COLORS } from '../rules.ts';
import type { Card } from '../types.ts';

export type SortOrder = 'number' | 'color';

// The order a hand is shown in until its player picks another
export const DEFAULT_SORT_ORDER: SortOrder = 'number';

// Numbers first, then wilds, then skips
function rank(card: Card, order: SortOrder): number[] {
  if (card.kind === 'wild') return [1, 0, 0];
  if (card.kind === 'skip') return [2, 0, 0];
  const color = COLORS.indexOf(card.color);
  return order === 'number' ? [0, card.value, color] : [0, color, card.value];
}

export function sortHand(cards: Card[], order: SortOrder): Card[] {
  return [...cards].sort((a, b) => {
    const left = rank(a, order);
    const right = rank(b, order);
    return left.map((value, index) => value - right[index]).find(difference => difference !== 0) ?? a.id - b.id;
  });
}
