// Which territories the player may click now, and where a chosen source can attack or move to
import { NEIGHBORS } from '../map.ts';
import { connectedTerritories } from '../placement.ts';
import type { PublicGameState, Seat } from '../types.ts';

type MapState = Pick<PublicGameState, 'phase' | 'owners' | 'armies'>;

export function canBeSource(state: MapState, seat: Seat, id: string): boolean {
  if (state.owners[id] !== seat) return false;
  if (state.phase === 'setup' || state.phase === 'reinforce') return true;
  if (state.armies[id] < 2) return false;
  return targetsFrom(state, seat, id).length > 0;
}

export function targetsFrom(state: MapState, seat: Seat, source: string | null): string[] {
  if (source === null || state.owners[source] !== seat || state.armies[source] < 2) return [];
  if (state.phase === 'attack') return NEIGHBORS[source].filter(id => state.owners[id] !== seat);
  if (state.phase === 'fortify') return connectedTerritories(state, source);
  return [];
}
