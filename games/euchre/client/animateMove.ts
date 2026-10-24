import { slideFrom } from '../../../src/animation/motion.ts';
import { SUITS, rankOf, sameCard, suitOf } from '../rules.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { Card, PublicGameState, Suit } from '../types.ts';
import { handKey, seatKey, trickKey } from '../../../src/animation/animKeys.ts';


// A hand is shown suit by suit, low to high, with trump (the left bower among it) last
export function sortedHand(hand: Card[], trump: Suit | null): Card[] {
  const order = (card: Card) => {
    const suit = suitOf(card, trump);
    return (suit === trump ? 4 : SUITS.indexOf(suit)) * 100 + rankOf(card, trump);
  };
  return [...hand].sort((a, b) => order(a) - order(b));
}

// A played card slides into its place in the middle, from your hand or from the seat of the player who played it
export default function animateMove({ previous, next, root, rectOf }: MoveChange<PublicGameState>) {
  const { lastMove } = next;
  if (lastMove?.type !== 'play') return;
  const mine = next.hand.length === previous.hand.length - 1;
  const fromKey = mine
    ? handKey(sortedHand(previous.hand, previous.trump).findIndex(card => sameCard(card, lastMove.card)))
    : seatKey(lastMove.playerNumber);
  const element = root.querySelector(`[data-anim-key="${trickKey(lastMove.playerNumber)}"]`);
  const from = rectOf(fromKey);
  if (element && from) slideFrom(element, from);
}
