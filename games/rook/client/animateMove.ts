import { slideFrom } from '../../../src/animation/motion.ts';
import { COLORS, sameCard } from '../rules.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { Card, PublicGameState } from '../types.ts';
import { handKey, seatKey, trickKey } from '../../../src/animation/animKeys.ts';


// A hand is shown color by color, low to high, with the Rook last
const order = (card: Card) => card.color === 'rook' ? 1000 : COLORS.indexOf(card.color) * 100 + card.number;
export const sortedHand = (hand: Card[]): Card[] => [...hand].sort((a, b) => order(a) - order(b));

// A played card slides into its place in the middle, from your hand or from the seat of the player who played it
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
