import { fadeIn, slideFrom } from '../../../src/animation/motion.ts';
import { buildingKey, roadKey, robberKey } from './layout.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { PublicGameState } from '../types.ts';

// The robber glides to its new hex, and a new road, settlement or city fades in
export default function animateMove({ previous, next, root, rectOf }: MoveChange<PublicGameState>) {
  const element = (key: string) => root.querySelector(`[data-anim-key="${key}"]`);
  if (previous.robber !== next.robber) {
    const robber = element(robberKey);
    const from = rectOf(robberKey);
    if (robber && from) slideFrom(robber, from, 450);
  }
  for (const edge of Object.keys(next.roads)) {
    const added = element(roadKey(Number(edge)));
    if (added && !(edge in previous.roads)) fadeIn(added);
  }
  for (const [vertex, building] of Object.entries(next.buildings)) {
    const before = previous.buildings[Number(vertex)];
    const changed = element(buildingKey(Number(vertex)));
    if (changed && (!before || before.city !== building.city)) fadeIn(changed);
  }
}
