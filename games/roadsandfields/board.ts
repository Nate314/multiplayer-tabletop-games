// The board: where a tile may go, and the connected features (cities, roads, fields, monasteries) the tiles make.
// Features are worked out again from the placements whenever they are needed, so the state holds only the tiles and meeples.
import { STEPS, TILES, cityAt, edgeAt, facingHalf, fieldAt, opposite, roadAt } from './tiles.ts';
import type { FeatureKind, FeatureRef, Placement, Seat, Side, TileType } from './types.ts';

const SIDES: Side[] = [0, 1, 2, 3];

export const key = (x: number, y: number) => `${x},${y}`;

export type Spot = { x: number; y: number };

export function boardIndex(board: Placement[]): Map<string, number> {
  return new Map(board.map((placement, index) => [key(placement.x, placement.y), index]));
}

// Why a tile cannot go here turned this way, or null when it can: the square must be empty, next to a tile,
// and every side that touches a tile must show the same edge (city to city, road to road, field to field)
export function placementError(board: Placement[], type: TileType, x: number, y: number, rotation: number): string | null {
  const at = boardIndex(board);
  if (at.has(key(x, y))) return 'That square is taken';
  let neighbours = 0;
  for (const side of SIDES) {
    const index = at.get(key(x + STEPS[side].dx, y + STEPS[side].dy));
    if (index === undefined) continue;
    neighbours++;
    const other = board[index];
    if (edgeAt(type, rotation, side) !== edgeAt(other.tile, other.rotation, opposite(side))) {
      return 'The tile must match the edges of the tiles next to it';
    }
  }
  return neighbours === 0 ? 'The tile must touch a tile already on the board' : null;
}

// The empty squares next to the board
export function frontier(board: Placement[]): Spot[] {
  const at = boardIndex(board);
  const spots = new Map<string, Spot>();
  for (const { x, y } of board) {
    for (const side of SIDES) {
      const spot = { x: x + STEPS[side].dx, y: y + STEPS[side].dy };
      if (!at.has(key(spot.x, spot.y))) spots.set(key(spot.x, spot.y), spot);
    }
  }
  return [...spots.values()];
}

export type PlacementOption = Spot & { rotations: number[] };

// Every square the tile fits, with the turns that fit there
export function placementOptions(board: Placement[], type: TileType): PlacementOption[] {
  return frontier(board)
    .map(spot => ({ ...spot, rotations: [0, 1, 2, 3].filter(rotation => placementError(board, type, spot.x, spot.y, rotation) === null) }))
    .filter(option => option.rotations.length > 0);
}

export function canPlace(board: Placement[], type: TileType): boolean {
  return placementOptions(board, type).length > 0;
}

// A connected feature across the board: which tile features make it up, how many tiles it covers, whether it is closed,
// the meeples on it, its pennants, and for a field the cities (by feature id) it borders
export type Feature = {
  id: number;
  kind: FeatureKind;
  parts: { tile: number; index: number }[]; // board index and the tile's feature index
  tiles: number[]; // board indexes, each once
  openEdges: number; // sides of a city or road with no tile beside them yet; for a monastery, empty squares around it
  pennants: number;
  meeples: Seat[];
  cities: number[];
};

const nodeKey = (kind: FeatureKind, tile: number, index: number) => `${kind}:${tile}:${index}`;

// Union-find over every tile feature on the board
class Groups {
  private parent = new Map<string, string>();
  find(node: string): string {
    let root = node;
    while (this.parent.has(root) && this.parent.get(root) !== root) root = this.parent.get(root)!;
    this.parent.set(node, root);
    return root;
  }
  join(a: string, b: string) {
    const rootA = this.find(a), rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootA, rootB);
  }
}

const AROUND = [-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dy => ({ dx, dy }))).filter(({ dx, dy }) => dx !== 0 || dy !== 0);

export type Features = {
  list: Feature[];
  of(tile: number, ref: FeatureRef): Feature | undefined; // the feature a tile's own feature belongs to
};

export function analyze(board: Placement[]): Features {
  const at = boardIndex(board);
  const groups = new Groups();
  const neighbour = (placement: Placement, side: Side) => at.get(key(placement.x + STEPS[side].dx, placement.y + STEPS[side].dy));

  board.forEach((placement, tile) => {
    for (const side of SIDES) {
      const other = neighbour(placement, side);
      if (other === undefined || other < tile) continue; // each touching pair once
      const next = board[other];
      const facing = opposite(side);
      const cityHere = cityAt(placement.tile, placement.rotation, side);
      const cityThere = cityAt(next.tile, next.rotation, facing);
      if (cityHere >= 0 && cityThere >= 0) groups.join(nodeKey('city', tile, cityHere), nodeKey('city', other, cityThere));
      const roadHere = roadAt(placement.tile, placement.rotation, side);
      const roadThere = roadAt(next.tile, next.rotation, facing);
      if (roadHere >= 0 && roadThere >= 0) groups.join(nodeKey('road', tile, roadHere), nodeKey('road', other, roadThere));
      for (const half of [2 * side, 2 * side + 1]) {
        const fieldHere = fieldAt(placement.tile, placement.rotation, half);
        const fieldThere = fieldAt(next.tile, next.rotation, facingHalf(half));
        if (fieldHere >= 0 && fieldThere >= 0) groups.join(nodeKey('field', tile, fieldHere), nodeKey('field', other, fieldThere));
      }
    }
  });

  const byRoot = new Map<string, Feature>();
  const ofNode = new Map<string, Feature>();
  const add = (kind: FeatureKind, tile: number, index: number, openEdges: number, pennants: number) => {
    const node = nodeKey(kind, tile, index);
    const root = groups.find(node);
    let feature = byRoot.get(root);
    if (!feature) {
      feature = { id: byRoot.size, kind, parts: [], tiles: [], openEdges: 0, pennants: 0, meeples: [], cities: [] };
      byRoot.set(root, feature);
    }
    feature.parts.push({ tile, index });
    if (!feature.tiles.includes(tile)) feature.tiles.push(tile);
    feature.openEdges += openEdges;
    feature.pennants += pennants;
    const { meeple } = board[tile];
    if (meeple && meeple.feature.kind === kind && meeple.feature.index === index) feature.meeples.push(meeple.seat);
    ofNode.set(node, feature);
  };

  board.forEach((placement, tile) => {
    const definition = TILES[placement.tile];
    const open = (sides: Side[]) => sides.filter(own => {
      const side = ((own + placement.rotation) % 4) as Side;
      return neighbour(placement, side) === undefined;
    }).length;
    definition.cities.forEach((city, index) => add('city', tile, index, open(city.sides), city.pennant ? 1 : 0));
    definition.roads.forEach((road, index) => add('road', tile, index, open(road.sides), 0));
    definition.fields.forEach((_, index) => add('field', tile, index, 0, 0));
    if (definition.monastery) {
      const empty = AROUND.filter(({ dx, dy }) => !at.has(key(placement.x + dx, placement.y + dy))).length;
      add('monastery', tile, 0, empty, 0);
    }
  });

  // A field borders the cities its tiles' field parts border
  for (const feature of byRoot.values()) {
    if (feature.kind !== 'field') continue;
    const cities = new Set<number>();
    for (const { tile, index } of feature.parts) {
      for (const city of TILES[board[tile].tile].fields[index].cities) {
        const bordered = ofNode.get(nodeKey('city', tile, city));
        if (bordered) cities.add(bordered.id);
      }
    }
    feature.cities = [...cities].sort((a, b) => a - b);
  }

  return {
    list: [...byRoot.values()],
    of: (tile, ref) => ofNode.get(nodeKey(ref.kind, tile, ref.index))
  };
}

export function isComplete(feature: Feature): boolean {
  return feature.kind !== 'field' && feature.openEdges === 0;
}

// The tile's own features a meeple could stand on, in a fixed order: cities, roads, fields, then the monastery
export function tileFeatures(type: TileType): FeatureRef[] {
  const definition = TILES[type];
  return [
    ...definition.cities.map((_, index): FeatureRef => ({ kind: 'city', index })),
    ...definition.roads.map((_, index): FeatureRef => ({ kind: 'road', index })),
    ...definition.fields.map((_, index): FeatureRef => ({ kind: 'field', index })),
    ...(definition.monastery ? [{ kind: 'monastery', index: 0 } as FeatureRef] : [])
  ];
}

export function meeplesOnBoard(board: Placement[], seat: Seat): number {
  return board.filter(placement => placement.meeple?.seat === seat).length;
}
