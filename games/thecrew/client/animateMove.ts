import { slideFrom } from '../../../src/animation/motion.ts';
import { COLORS, sameCard } from '../rules.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { Card, PublicGameState, Seat } from '../types.ts';
import { handKey, seatKey, trickKey } from '../../../src/animation/animKeys.ts';


// A hand is shown suit by suit, low to high, with the rockets last
const order = (card: Card) => (card.suit === 'rocket' ? 400 : COLORS.indexOf(card.suit) * 100) + card.value;
export const sortedHand = (hand: Card[]): Card[] => [...hand].sort((a, b) => order(a) - order(b));

// A played card slides into the trick, from your hand or from the seat of the player who played it
export default function animateMove({ previous, next, root, rectOf }: MoveChange<PublicGameState>) {
  const { lastMove } = next;
  if (lastMove?.type !== 'play') return;
  const mine = next.hand.length === previous.hand.length - 1;
  const fromKey = mine
    ? handKey(sortedHand(previous.hand).findIndex(card => sameCard(card, lastMove.card)))
    : seatKey(lastMove.playerNumber);
  const element = root.querySelector(`[data-anim-key="${trickKey(lastMove.playerNumber)}"]`);
  const from = rectOf(fromKey);
  if (element && from) slideFrom(element, from);
}
