// Where things go on the drawn map: continent shapes, labels, short territory names and seat colors
import { CONTINENTS, TERRITORIES } from '../map.ts';
import type { SymbolColor } from '../../../src/components/colorSymbols.ts';
import type { ContinentId, Seat } from '../types.ts';

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 620;
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

// The convex hull of a continent's territories, which the map draws with a wide round stroke as its land
function hull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: Point[]) => {
    const result: Point[] = [];
    for (const point of list) {
      while (result.length >= 2 && cross(result[result.length - 2], result[result.length - 1], point) <= 0) result.pop();
      result.push(point);
    }
    result.pop();
    return result;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

export const CONTINENT_SHAPES: Record<ContinentId, string> = Object.fromEntries(CONTINENTS.map(({ id }) => {
  const points = hull(TERRITORIES.filter(territory => territory.continent === id));
  return [id, points.map(({ x, y }) => `${x},${y}`).join(' ')];
})) as Record<ContinentId, string>;

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
