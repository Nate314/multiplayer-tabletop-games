// Where things go on the drawn map (the land itself is games/risk/svg.ts): labels, short territory names and seat colors
import { TERRITORIES } from '../map.ts';
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
  northAmerica: { x: 70, y: 345 },
  southAmerica: { x: 150, y: 520 },
  europe: { x: 470, y: 22 },
  africa: { x: 420, y: 560 },
  asia: { x: 680, y: 22 },
  australia: { x: 740, y: 600 }
};

// Names that fit under a territory on the map; the full name is its tooltip
const SHORT: Record<string, string> = {
  northwestTerritory: 'NW Territory',
  westernUnitedStates: 'W. United States',
  easternUnitedStates: 'E. United States',
  centralAmerica: 'C. America',
  northernEurope: 'N. Europe',
  westernEurope: 'W. Europe',
  southernEurope: 'S. Europe',
  greatBritain: 'Gt. Britain',
  westernAustralia: 'W. Australia',
  easternAustralia: 'E. Australia'
};

export function shortName(id: string): string {
  return SHORT[id] ?? TERRITORIES.find(territory => territory.id === id)?.name ?? id;
}

export function continentShort(id: ContinentId): string {
  return { northAmerica: 'N. America', southAmerica: 'S. America', europe: 'Europe', africa: 'Africa', asia: 'Asia', australia: 'Australia' }[id];
}
