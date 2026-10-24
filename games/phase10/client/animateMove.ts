import { ghostSlide, flash, slideFrom } from '../../../src/animation/motion.ts';
import { seatKey } from '../../../src/animation/animKeys.ts';
import { cardFace } from '../rules.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { Card, PublicGameState } from '../types.ts';

export const cardKey = (id: number) => `card-${id}`;
export const PILE_KEY = 'pile';
export const DISCARD_KEY = 'discard';

export type Ghost = { card: Card | null; from: string; to: string };

// slides are [from key, to key]: the element at the to key slides in from where the from key was.
// A ghost is a copy of a card that went to a seat, where no card of it is shown.
export type Phase10Plan = { slides: [string, string][]; ghosts: Ghost[]; flash: string | null };

const NOTHING: Phase10Plan = { slides: [], ghosts: [], flash: null };

// "Mine" is told from the viewer's own hand, so no viewer is needed
const has = (cards: Card[], id: number) => cards.some(card => card.id === id);

export function plan(previous: PublicGameState, next: PublicGameState): Phase10Plan {
  const { lastMove } = next;
  if (!lastMove) return NOTHING;
  const seat = seatKey(lastMove.playerNumber);
  // Where a card of the mover's came from: its place in your hand, or their seat
  const origin = (id: number) => (has(previous.myHand, id) ? cardKey(id) : seat);

  switch (lastMove.type) {
    case 'draw': {
      const from = lastMove.source === 'pile' ? PILE_KEY : DISCARD_KEY;
      const drawn = next.myHand.filter(card => !has(previous.myHand, card.id));
      if (drawn.length > 0) return { slides: drawn.map(card => [from, cardKey(card.id)]), ghosts: [], flash: null };
      const card = lastMove.source === 'discard' ? lastMove.card : null;
      return { slides: [], ghosts: [{ card, from, to: seat }], flash: null };
    }
    case 'layDown': {
      const ids = next.groups.slice(previous.groups.length).flatMap(group => group.cards.map(card => card.id));
      return { slides: ids.map(id => [origin(id), cardKey(id)]), ghosts: [], flash: null };
    }
    case 'hit': {
      const before = previous.groups[lastMove.group]?.cards ?? [];
      const added = (next.groups[lastMove.group]?.cards ?? []).filter(card => !has(before, card.id));
      return { slides: added.map(card => [origin(card.id), cardKey(card.id)]), ghosts: [], flash: null };
    }
    case 'discard':
      return {
        slides: [[origin(lastMove.card.id), DISCARD_KEY]],
        ghosts: [],
        flash: lastMove.skipped === null ? null : seatKey(lastMove.skipped)
      };
  }
}

// A copy of a card as CardView draws it, or a card back for a card nobody can see
function ghostCard(card: Card | null): HTMLElement {
  const ghost = document.createElement('span');
  ghost.setAttribute('aria-hidden', 'true');
  if (!card) {
    ghost.className = 'card card-back';
    ghost.textContent = '10';
    return ghost;
  }
  ghost.className = `card card-${card.kind === 'number' ? card.color : card.kind}`;
  const face = ghost.appendChild(document.createElement('span'));
  face.className = 'card-face';
  face.textContent = cardFace(card);
  return ghost;
}

// Every card the move put somewhere new slides there from where it was; a card that went to a seat flies there as a copy
export default function animateMove({ previous, next, root, rectOf }: MoveChange<PublicGameState>) {
  const { slides, ghosts, flash: flashKey } = plan(previous, next);
  const find = (key: string) => root.querySelector<HTMLElement>(`[data-anim-key="${key}"]`);

  for (const [fromKey, toKey] of slides) {
    const element = find(toKey);
    const from = rectOf(fromKey);
    if (element && from) slideFrom(element, from);
  }
  for (const { card, from: fromKey, to: toKey } of ghosts) {
    const to = find(toKey)?.getBoundingClientRect();
    const from = rectOf(fromKey);
    if (to && from) ghostSlide(root, ghostCard(card), from, to);
  }
  const flashed = flashKey === null ? null : find(flashKey);
  if (flashed) flash(flashed);
}
