// Where things go on the drawn map (the land itself is games/territories/svg.ts): labels and seat colors
import { CONTINENTS } from '../map.ts';
import type { SymbolColor } from '../../../src/components/colorSymbols.ts';
import type { ContinentId, Seat } from '../types.ts';

export { MAP_WIDTH, MAP_HEIGHT } from '../map.ts';
export const TERRITORY_RADIUS = 17;

// The color-blind symbol for each seat's color; neutral armies have none
export const SEAT_SYMBOLS: Record<Seat, SymbolColor> = { 1: 'red', 2: 'blue', 3: 'green', 4: 'yellow', 5: 'purple', 6: 'black' };

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
  westmarch: { x: 95, y: 336 },
  sunreach: { x: 105, y: 588 },
  highvale: { x: 500, y: 38 },
  amberveld: { x: 470, y: 598 },
  eastwild: { x: 660, y: 18 },
  coralIsles: { x: 860, y: 598 }
};

export function continentShort(id: ContinentId): string {
  return CONTINENTS.find(continent => continent.id === id)!.name;
}
