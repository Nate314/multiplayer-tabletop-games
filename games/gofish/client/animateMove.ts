import { fadeIn, slideFrom } from '../../../src/animation/motion.ts';
import { RANKS, sameCard, SUITS } from '../../../shared/playingCards.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { PlayingCard, PublicGameState, Rank, Seat } from '../types.ts';

export const cardKey = (card: PlayingCard) => `card-${card.rank}-${card.suit}`;
export const seatKey = (seat: Seat) => `seat-${seat}`;
export const bookKey = (rank: Rank) => `book-${rank}`;
export const STOCK_KEY = 'stock';

// A hand shown rank by rank, ace to king, each rank's cards in suit order
export function groupByRank(hand: PlayingCard[]): { rank: Rank; cards: PlayingCard[] }[] {
  return RANKS
    .map(rank => ({ rank, cards: SUITS.flatMap(suit => hand.filter(card => card.rank === rank && card.suit === suit)) }))
    .filter(group => group.cards.length > 0);
}

// Cards new in the viewer's hand slide in from the player who handed them over, or from the stock;
// a book just laid down fades in
export default function animateMove({ previous, next, root, rectOf }: MoveChange<PublicGameState>) {
  const { lastMove } = next;
  if (!lastMove) return;
  const arrived = next.hand.filter(card => !previous.hand.some(held => sameCard(held, card)));
  for (const card of arrived) {
    const handed = lastMove.fished === 'none' && card.rank === lastMove.rank;
    const from = rectOf(handed ? seatKey(lastMove.target) : STOCK_KEY);
    const element = root.querySelector(`[data-anim-key="${cardKey(card)}"]`);
    if (element && from) slideFrom(element, from);
  }
  for (const rank of lastMove.books) {
    const element = root.querySelector(`[data-anim-key="${bookKey(rank)}"]`);
    if (element) fadeIn(element);
  }
}
