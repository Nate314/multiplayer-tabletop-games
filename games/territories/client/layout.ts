// Where things go on the drawn map (the land itself is games/territories/svg.ts): labels and seat colors
import { CONTINENTS } from '../map.ts';
import type { ContinentId, Seat } from '../types.ts';

export { MAP_WIDTH, MAP_HEIGHT } from '../map.ts';
export const TERRITORY_RADIUS = 17;

export function seatClass(seat: Seat | null | undefined): string {
  if (seat === null) return 'seat-neutral';
  return seat === undefined ? 'seat-none' : `seat${seat}`;
}

export function territoryKey(id: string): string {
  return `territory-${id}`;
}

type Point = { x: number; y: number };

// Each continent's name and bonus sits in the sea next to it
export const CONTINENT_LABELS: Record<ContinentId, Point> = {
  westmarch: { x: 186, y: 390 },
  sunreach: { x: 930, y: 438 },
  highvale: { x: 477, y: 18 },
  amberveld: { x: 491, y: 574 },
  eastwild: { x: 732, y: 414 },
  coralIsles: { x: 170, y: 434 }
};

export function continentShort(id: ContinentId): string {
  return CONTINENTS.find(continent => continent.id === id)!.name;
}
