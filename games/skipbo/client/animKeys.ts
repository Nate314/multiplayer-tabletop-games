import type { Card, Seat } from '../types.ts';

// data-anim-key values: every face-up card by its id, and each player's hand count for a card from a hidden hand
export const cardKey = (card: Card) => `card-${card.id}`;
export const handKey = (seat: Seat) => `hand-${seat}`;
