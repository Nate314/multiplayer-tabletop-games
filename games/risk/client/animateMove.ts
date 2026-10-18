import { fadeIn } from '../../../src/animation/motion.ts';
import { TERRITORIES } from '../map.ts';
import { territoryKey } from './layout.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { PublicGameState } from '../types.ts';

// A territory that changed hands fades in its new color
export default function animateMove({ previous, next, root }: MoveChange<PublicGameState>) {
  for (const { id } of TERRITORIES) {
    if (previous.owners[id] === next.owners[id]) continue;
    const element = root.querySelector(`[data-anim-key="${territoryKey(id)}"] .disc`);
    if (element) fadeIn(element, 500);
  }
}
