import { slideFrom, tumble } from '../../../src/animation/motion.ts';
import { SUSPECTS } from '../content.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { PublicGameState } from '../types.ts';
import type { SuspectId } from '../content.ts';

export const tokenKey = (suspect: SuspectId) => `token-${suspect}`;
export const dieKey = (index: number) => `wd-die-${index}`;

// Every token that changed square or room glides there from where it was; a roll tumbles both dice
export default function animateMove({ previous, next, root, rectOf }: MoveChange<PublicGameState>) {
  const find = (key: string) => root.querySelector(`[data-anim-key="${key}"]`);
  for (const { id } of SUSPECTS) {
    if (JSON.stringify(previous.positions[id]) === JSON.stringify(next.positions[id])) continue;
    const element = find(tokenKey(id));
    const from = rectOf(tokenKey(id));
    if (element && from) slideFrom(element, from, 450);
  }
  if (next.lastMove?.type === 'roll') {
    for (const key of [dieKey(0), dieKey(1)]) {
      const die = find(key);
      if (die) tumble(die);
    }
  }
}
