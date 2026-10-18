import { slideFrom } from '../../../src/animation/motion.ts';
import { buildDeck, sameCard } from '../rules.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { Card, PublicGameState, Seat } from '../types.ts';

export const handKey = (slot: number) => `hand-${slot}`;
export const seatKey = (seat: Seat) => `seat-${seat}`;
export const DISCARD_KEY = 'discard';

// The deck's own order (color by color, numbers before symbols) is how a hand is shown, wilds last
const ORDER = buildDeck();
const rank = (card: Card) => ORDER.findIndex(other => sameCard(other, card));
export const sortedHand = (hand: Card[]): Card[] => [...hand].sort((a, b) => rank(a) - rank(b));

// The played card slides onto the discard pile from your hand, or from the player who played it
export default function animateMove({ previous, next, root, rectOf }: MoveChange<PublicGameState>) {
  const { lastMove } = next;
  if (lastMove?.type !== 'play') return;
  // Only your own play takes a card out of your hand without adding any
  const mine = next.hand.length === previous.hand.length - 1;
  const fromKey = mine
    ? handKey(sortedHand(previous.hand).findIndex(card => sameCard(card, lastMove.card)))
    : seatKey(lastMove.playerNumber);
  const element = root.querySelector(`[data-anim-key="${DISCARD_KEY}"]`);
  const from = rectOf(fromKey);
  if (element && from) slideFrom(element, from);
}

