import { slideFrom } from '../../../src/animation/motion.ts';
import { sameCard } from '../../../shared/playingCards.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { PublicGameState, Seat } from '../types.ts';
import { handKey, seatKey, trickKey } from '../../../src/animation/animKeys.ts';


// A played card slides into its place in the middle, from your hand or from the seat of the player who played it
export default function animateMove({ previous, next, root, rectOf }: MoveChange<PublicGameState>) {
  const { lastMove } = next;
  if (lastMove?.type !== 'play') return;
  const mine = next.hand.length === previous.hand.length - 1;
  const fromKey = mine ? handKey(previous.hand.findIndex(card => sameCard(card, lastMove.card))) : seatKey(lastMove.playerNumber);
  const element = root.querySelector(`[data-anim-key="${trickKey(lastMove.playerNumber)}"]`);
  const from = rectOf(fromKey);
  if (element && from) slideFrom(element, from);
}
