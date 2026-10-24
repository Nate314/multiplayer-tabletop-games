import { slideFrom } from '../../../src/animation/motion.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { PublicGameState, Seat } from '../types.ts';

export const DECK_KEY = 'deck';
export const DISCARD_KEY = 'discard';
export const HELD_KEY = 'held';
export const slotKey = (seat: Seat, slot: number) => `slot-${seat}-${slot}`;

// [from key, to key] pairs: the tile at the to key slides in from where the from key was.
// Other racks are keyed per seat and slot too, so every viewer gets the same plan.
export function slides(_previous: PublicGameState, next: PublicGameState): [string, string][] {
  const { lastMove } = next;
  if (!lastMove) return [];
  switch (lastMove.type) {
    case 'draw':
      return [[lastMove.from === 'deck' ? DECK_KEY : DISCARD_KEY, HELD_KEY]];
    case 'place': {
      const slot = slotKey(lastMove.playerNumber, lastMove.slot);
      return [[HELD_KEY, slot], [slot, DISCARD_KEY]];
    }
    case 'discard':
      return [[HELD_KEY, DISCARD_KEY]];
  }
}

// The card in hand arrives from its pile, a swapped card goes into the slot, and the card it replaced leaves for the discard pile.
// A tile that is not on screen (the held spot after a placement) is skipped.
export default function animateMove({ previous, next, root, rectOf }: MoveChange<PublicGameState>) {
  for (const [fromKey, toKey] of slides(previous, next)) {
    const element = root.querySelector<HTMLElement>(`[data-anim-key="${toKey}"]`);
    const from = rectOf(fromKey);
    if (element && from) slideFrom(element, from);
  }
}
