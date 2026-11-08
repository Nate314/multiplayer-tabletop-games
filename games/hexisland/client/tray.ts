// Why a piece in the building tray or a build button cannot be used now
import { COSTS, covers, describeResources } from '../resources.ts';
import { buildChance } from '../specialBuild.ts';
import type { PublicGameState, Resources } from '../types.ts';

export type TrayKind = 'road' | 'settlement' | 'city';

// Why a build button or tray piece is unavailable after the roll, '' when it can be built
export function buildBlocker(kind: TrayKind, hand: Resources | null, spots: number): string {
  if (!hand || !covers(hand, COSTS[kind])) return `Needs ${describeResources(COSTS[kind])}`;
  return spots === 0 ? `Nowhere to build a ${kind}` : '';
}

// Why a tray piece is dimmed now, '' when it can be lifted: in a special build phase buildBlocker during the viewer's
// own build chance, in setup only the piece the step asks for, during free roads only the road, after the roll and
// with nothing pending buildBlocker, otherwise 'Not now'
export function trayBlocker(state: PublicGameState, kind: TrayKind, spots: number): string {
  const { setup, pending, rolled } = state;
  if (state.specialBuild) return buildChance(state, state.viewer) ? buildBlocker(kind, state.hand, spots) : 'Not now';
  if (setup) return kind === (setup.settlement === null ? 'settlement' : 'road') ? '' : 'Not now';
  if (pending?.kind === 'roadBuilding') return kind === 'road' ? '' : 'Not now';
  if (pending || !rolled) return 'Not now';
  return buildBlocker(kind, state.hand, spots);
}
