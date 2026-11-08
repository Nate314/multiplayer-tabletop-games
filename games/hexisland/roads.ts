// Longest Road: each player's longest single line of roads, and who holds the Longest Road and Largest Army cards.
// A line may not go through an intersection holding another player's settlement or city, which breaks it there.
import { boardOf } from './board.ts';
import type { GameState, Seat } from './types.ts';

export const LONGEST_ROAD_MINIMUM = 5;
export const LARGEST_ARMY_MINIMUM = 3;
export const AWARD_POINTS = 2;

type RoadView = Pick<GameState, 'layout' | 'roads' | 'buildings'>;

// The longest trail of `seat`'s roads, counting each road once
export function longestRoadOf(state: RoadView, seat: Seat): number {
  const { edges, vertexEdges } = boardOf(state.layout);
  const otherEnd = (edge: number, vertex: number) => edges[edge][0] === vertex ? edges[edge][1] : edges[edge][0];
  const blocked = (vertex: number) => {
    const building = state.buildings[vertex];
    return building !== undefined && building.seat !== seat;
  };
  const used = new Set<number>();
  // Extends a line arriving at `vertex`; a line may end at a blocked intersection but not pass it
  const extend = (vertex: number, start: boolean): number => {
    if (!start && blocked(vertex)) return 0;
    let best = 0;
    for (const edge of vertexEdges[vertex]) {
      if (state.roads[edge] !== seat || used.has(edge)) continue;
      used.add(edge);
      best = Math.max(best, 1 + extend(otherEnd(edge, vertex), false));
      used.delete(edge);
    }
    return best;
  };
  const ends = new Set(Object.keys(state.roads).map(Number).filter(edge => state.roads[edge] === seat).flatMap(edge => edges[edge]));
  let longest = 0;
  for (const vertex of ends) longest = Math.max(longest, extend(vertex, true));
  return longest;
}

export function roadLengths(state: RoadView & Pick<GameState, 'activePlayers'>): Record<Seat, number> {
  return Object.fromEntries(state.activePlayers.map(seat => [seat, longestRoadOf(state, seat)]));
}

// Who holds a card after a change: the holder keeps it while nobody has more; otherwise the one player with the
// most (at least `minimum`) takes it, and on a tie for most nobody does until the tie is broken
export function awardHolder(holder: Seat | null, values: Record<Seat, number>, minimum: number, players: Seat[]): Seat | null {
  const best = Math.max(0, ...players.map(seat => values[seat] ?? 0));
  if (best < minimum) return null;
  if (holder !== null && players.includes(holder) && values[holder] === best) return holder;
  const leaders = players.filter(seat => values[seat] === best);
  return leaders.length === 1 ? leaders[0] : null;
}
