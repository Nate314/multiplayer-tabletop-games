import { slideFrom } from '../../../src/animation/motion.ts';
import { cardKey, handKey } from './animKeys.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { PublicGameState } from '../types.ts';

// The played or discarded card slides to where it landed: from where it was shown (your hand, a stock or a discard top),
// or from the player's hand count when their hand was hidden. A completed pile has left the table, so nothing slides.
export default function animateMove({ next, root, rectOf }: MoveChange<PublicGameState>) {
  const { lastMove } = next;
  if (lastMove === null || lastMove.type === 'endTurn') return;
  if (lastMove.type === 'play' && lastMove.completed) return;
  const key = cardKey(lastMove.card);
  const element = root.querySelector(`[data-anim-key="${key}"]`);
  const from = rectOf(key) ?? rectOf(handKey(lastMove.playerNumber));
  if (element && from) slideFrom(element, from);
}
