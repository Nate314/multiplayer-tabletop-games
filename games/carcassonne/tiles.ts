// The 72 land tiles of the base game and how a turned tile's sides and features line up.
// Counts per type, checked against two independent tile lists: A 2, B 4, C 1, D 4 (the start tile is one of them),
// E 5, F 2, G 1, H 3, I 2, J 3, K 3, L 3, M 2, N 3, O 2, P 3, Q 1, R 3, S 2, T 1, U 8, V 9, W 4, X 1.
// Ten tiles carry a pennant: C, both F, both M, both O, Q and both S.
import type { Edge, FieldFeature, RoadFeature, CityFeature, Side, TileDefinition, TileType } from './types.ts';

export const MEEPLES_PER_PLAYER = 7;
export const START_TILE: TileType = 'D';

const N = 0, E = 1, S = 2, W = 3;
const city = (sides: Side[], pennant = false): CityFeature => ({ sides, pennant });
const road = (...sides: Side[]): RoadFeature => ({ sides });
const field = (halves: number[], cities: number[] = []): FieldFeature => ({ halves, cities });
const ALL_HALVES = [0, 1, 2, 3, 4, 5, 6, 7];

function tile(
  type: TileType, count: number, edges: string, features: Partial<Omit<TileDefinition, 'type' | 'count' | 'edges'>>
): TileDefinition {
  const edgeOf = (letter: string): Edge => (letter === 'C' ? 'city' : letter === 'R' ? 'road' : 'field');
  return {
    type,
    count,
    edges: [edgeOf(edges[0]), edgeOf(edges[1]), edgeOf(edges[2]), edgeOf(edges[3])],
    cities: features.cities ?? [],
    roads: features.roads ?? [],
    fields: features.fields ?? [],
    monastery: features.monastery ?? false
  };
}

// Edges are given north, east, south, west: C city, R road, F field
export const TILES: Record<TileType, TileDefinition> = {
  // Monastery with a road leaving south
  A: tile('A', 2, 'FFRF', { monastery: true, roads: [road(S)], fields: [field(ALL_HALVES)] }),
  // Monastery in a field
  B: tile('B', 4, 'FFFF', { monastery: true, fields: [field(ALL_HALVES)] }),
  // City on every side, with a pennant
  C: tile('C', 1, 'CCCC', { cities: [city([N, E, S, W], true)] }),
  // City on one side, straight road across (the start tile)
  D: tile('D', 4, 'CRFR', { cities: [city([N])], roads: [road(E, W)], fields: [field([2, 7], [0]), field([3, 4, 5, 6])] }),
  // City on one side
  E: tile('E', 5, 'CFFF', { cities: [city([N])], fields: [field([2, 3, 4, 5, 6, 7], [0])] }),
  // City across the middle from east to west, with a pennant
  F: tile('F', 2, 'FCFC', { cities: [city([E, W], true)], fields: [field([0, 1], [0]), field([4, 5], [0])] }),
  // City across the middle from east to west
  G: tile('G', 1, 'FCFC', { cities: [city([E, W])], fields: [field([0, 1], [0]), field([4, 5], [0])] }),
  // Two separate cities on opposite sides
  H: tile('H', 3, 'FCFC', { cities: [city([E]), city([W])], fields: [field([0, 1, 4, 5], [0, 1])] }),
  // Two separate cities on neighbouring sides
  I: tile('I', 2, 'CCFF', { cities: [city([N]), city([E])], fields: [field([4, 5, 6, 7], [0, 1])] }),
  // City on one side, road curving from east to south
  J: tile('J', 3, 'CRRF', { cities: [city([N])], roads: [road(E, S)], fields: [field([3, 4]), field([2, 5, 6, 7], [0])] }),
  // City on one side, road curving from south to west
  K: tile('K', 3, 'CFRR', { cities: [city([N])], roads: [road(S, W)], fields: [field([5, 6]), field([2, 3, 4, 7], [0])] }),
  // City on one side, three roads ending at a junction
  L: tile('L', 3, 'CRRR', {
    cities: [city([N])],
    roads: [road(E), road(S), road(W)],
    fields: [field([2, 7], [0]), field([3, 4]), field([5, 6])]
  }),
  // City across the north and west corner, with a pennant
  M: tile('M', 2, 'CFFC', { cities: [city([N, W], true)], fields: [field([2, 3, 4, 5], [0])] }),
  // City across the north and west corner
  N: tile('N', 3, 'CFFC', { cities: [city([N, W])], fields: [field([2, 3, 4, 5], [0])] }),
  // City across the north and west corner with a pennant, road curving from east to south
  O: tile('O', 2, 'CRRC', { cities: [city([N, W], true)], roads: [road(E, S)], fields: [field([3, 4]), field([2, 5], [0])] }),
  // City across the north and west corner, road curving from east to south
  P: tile('P', 3, 'CRRC', { cities: [city([N, W])], roads: [road(E, S)], fields: [field([3, 4]), field([2, 5], [0])] }),
  // City on three sides, with a pennant
  Q: tile('Q', 1, 'CCFC', { cities: [city([N, E, W], true)], fields: [field([4, 5], [0])] }),
  // City on three sides
  R: tile('R', 3, 'CCFC', { cities: [city([N, E, W])], fields: [field([4, 5], [0])] }),
  // City on three sides with a pennant, road leaving south
  S: tile('S', 2, 'CCRC', { cities: [city([N, E, W], true)], roads: [road(S)], fields: [field([4], [0]), field([5], [0])] }),
  // City on three sides, road leaving south
  T: tile('T', 1, 'CCRC', { cities: [city([N, E, W])], roads: [road(S)], fields: [field([4], [0]), field([5], [0])] }),
  // Straight road from north to south
  U: tile('U', 8, 'RFRF', { roads: [road(N, S)], fields: [field([1, 2, 3, 4]), field([5, 6, 7, 0])] }),
  // Road curving from south to west
  V: tile('V', 9, 'FFRR', { roads: [road(S, W)], fields: [field([5, 6]), field([0, 1, 2, 3, 4, 7])] }),
  // Three roads ending at a junction
  W: tile('W', 4, 'FRRR', { roads: [road(E), road(S), road(W)], fields: [field([0, 1, 2, 7]), field([3, 4]), field([5, 6])] }),
  // Four roads ending at a crossroads
  X: tile('X', 1, 'RRRR', {
    roads: [road(N), road(E), road(S), road(W)],
    fields: [field([1, 2]), field([3, 4]), field([5, 6]), field([7, 0])]
  })
};

export const TILE_TYPES = Object.keys(TILES) as TileType[];

// Every tile but the start tile, in letter order, for shuffling into the draw pile
export function drawTiles(): TileType[] {
  return TILE_TYPES.flatMap(type => Array.from({ length: TILES[type].count - (type === START_TILE ? 1 : 0) }, () => type));
}

export function isTileType(value: unknown): value is TileType {
  return typeof value === 'string' && value in TILES;
}

// How the tile's own sides and half-edges sit once it is turned `rotation` quarter turns clockwise
export function turnSide(side: number, rotation: number): Side {
  return (((side + rotation) % 4) + 4) % 4 as Side;
}

export function turnHalf(half: number, rotation: number): number {
  return (((half + 2 * rotation) % 8) + 8) % 8;
}

// The edge a turned tile shows on a side of the board
export function edgeAt(type: TileType, rotation: number, side: Side): Edge {
  return TILES[type].edges[turnSide(side, -rotation)];
}

// The half-edge of the neighbour that touches this half-edge: the opposite side, the other half
export function facingHalf(half: number): number {
  const side = Math.floor(half / 2);
  return 2 * ((side + 2) % 4) + (1 - (half % 2));
}

export const STEPS: Record<Side, { dx: number; dy: number }> = {
  0: { dx: 0, dy: -1 },
  1: { dx: 1, dy: 0 },
  2: { dx: 0, dy: 1 },
  3: { dx: -1, dy: 0 }
};

export function opposite(side: Side): Side {
  return turnSide(side, 2);
}

// Index of the tile's city, road or field reaching a board side (or half-edge) of the turned tile, or -1
export function cityAt(type: TileType, rotation: number, side: Side): number {
  const own = turnSide(side, -rotation);
  return TILES[type].cities.findIndex(feature => feature.sides.includes(own));
}

export function roadAt(type: TileType, rotation: number, side: Side): number {
  const own = turnSide(side, -rotation);
  return TILES[type].roads.findIndex(feature => feature.sides.includes(own));
}

export function fieldAt(type: TileType, rotation: number, half: number): number {
  const own = turnHalf(half, -rotation);
  return TILES[type].fields.findIndex(feature => feature.halves.includes(own));
}

const NAMES: Record<TileType, string> = {
  A: 'a monastery with a road',
  B: 'a monastery',
  C: 'a city on every side',
  D: 'a city with a straight road',
  E: 'a city on one side',
  F: 'a city across the middle',
  G: 'a city across the middle',
  H: 'two cities on opposite sides',
  I: 'two cities on neighbouring sides',
  J: 'a city with a curved road',
  K: 'a city with a curved road',
  L: 'a city with a junction',
  M: 'a city across a corner',
  N: 'a city across a corner',
  O: 'a city across a corner with a road',
  P: 'a city across a corner with a road',
  Q: 'a city on three sides',
  R: 'a city on three sides',
  S: 'a city on three sides with a road',
  T: 'a city on three sides with a road',
  U: 'a straight road',
  V: 'a curved road',
  W: 'a three-way junction',
  X: 'a crossroads'
};

export function tileName(type: TileType): string {
  return NAMES[type];
}
