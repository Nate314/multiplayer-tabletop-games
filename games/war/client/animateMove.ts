import { slideFrom } from '../../../src/animation/motion.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { PublicGameState, Seat } from '../types.ts';

export const pileKey = (seat: Seat) => `pile-${seat}`;
export const battleKey = (seat: Seat, index: number) => `battle-${seat}-${index}`;

// The battle on the table: the one under way, or the one just settled
export const shownBattle = (state: PublicGameState) => state.battle ?? state.lastBattle;

// The cards a flip put into the battle slide there from the flipper's pile
export default function animateMove({ previous, next, root, rectOf }: MoveChange<PublicGameState>) {
  const { lastMove } = next;
  if (lastMove?.type !== 'flip') return;
  const seat = lastMove.playerNumber;
  const before = previous.battle?.cards[seat]?.length ?? 0;
  const after = shownBattle(next)?.cards[seat]?.length ?? 0;
  const from = rectOf(pileKey(seat));
  if (!from) return;
  for (let index = before; index < after; index++) {
    const element = root.querySelector(`[data-anim-key="${battleKey(seat, index)}"]`);
    if (element) slideFrom(element, from, undefined, (index - before) * 120);
  }
}
