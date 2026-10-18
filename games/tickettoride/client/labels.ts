import type { Card } from '../types.ts';

// A card's name as the screen writes it
export function cardLabel(card: Card): string {
  return card === 'locomotive' ? 'Locomotive' : card[0].toUpperCase() + card.slice(1);
}
