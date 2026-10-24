import { ghostSlide, tumble } from '../../../src/animation/motion.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { Category, PublicGameState, Seat } from '../types.ts';

export const DICE_KEY = 'dice';
export const dieKey = (index: number) => `die-${index}`;
export const cellKey = (seat: Seat, category: Category) => `cell-${seat}-${category}`;

// The dice that were rolled in the last move: all five on the first roll of a turn, the ones not held after that
export function tumbling({ lastMove, held }: PublicGameState): number[] {
  if (lastMove?.type !== 'roll') return [];
  return lastMove.dice.flatMap((_, index) => held[index] ? [] : [index]);
}

// [from key, to key]: the points leave the dice for the box they were written in
export function scoreSlide({ lastMove }: PublicGameState): [string, string] | null {
  return lastMove?.type === 'score' ? [DICE_KEY, cellKey(lastMove.playerNumber, lastMove.category)] : null;
}

// The score sheet scrolls inside its panel, which would hide a box sliding in from the dice,
// so the points fly as a copy outside the sheet and land on the box
function pointsLabel(points: number): HTMLElement {
  const label = document.createElement('span');
  label.className = 'yz-flying-points';
  label.setAttribute('aria-hidden', 'true');
  label.textContent = String(points);
  return label;
}

// Rolled dice tumble while held dice stay; a score flies from the dice to its box. A missing element is skipped.
export default function animateMove({ next, root, rectOf }: MoveChange<PublicGameState>) {
  const find = (key: string) => root.querySelector<HTMLElement>(`[data-anim-key="${key}"]`);

  for (const index of tumbling(next)) {
    const die = find(dieKey(index));
    if (die) tumble(die);
  }

  const slide = scoreSlide(next);
  const { lastMove } = next;
  if (slide && lastMove?.type === 'score') {
    const [fromKey, toKey] = slide;
    const cell = find(toKey)?.getBoundingClientRect();
    const dice = rectOf(fromKey);
    if (cell && dice) {
      // Starts as big as a box, in the middle of the dice
      const from = new DOMRect(dice.x + (dice.width - cell.width) / 2, dice.y + (dice.height - cell.height) / 2, cell.width, cell.height);
      ghostSlide(root, pointsLabel(lastMove.points), from, cell);
    }
  }
}
