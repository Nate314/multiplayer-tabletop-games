// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Random, Result, Seat, UndoVote } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

// A side of a tile, clockwise from the top: north, east, south, west
export type Side = 0 | 1 | 2 | 3;
export type Edge = 'city' | 'road' | 'field';
export type FeatureKind = 'city' | 'road' | 'field' | 'monastery';

// The tile types of the base game, lettered as the usual reference charts letter them (A to X)
export type TileType =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L'
  | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X';

// One feature of a tile, as the tile is printed (before it is turned). Cities and roads list the sides they reach;
// a road listing one side ends inside the tile (at a junction, a village, a city or a monastery).
// Fields list the half-edges they reach: each side has two, numbered clockwise from the top left corner, so the
// north side has 0 (west half) and 1 (east half), east 2 and 3, south 4 and 5, west 6 and 7. A city side has no field halves.
// `cities` are the indexes of the tile's own cities the field borders.
export type CityFeature = { sides: Side[]; pennant: boolean };
export type RoadFeature = { sides: Side[] };
export type FieldFeature = { halves: number[]; cities: number[] };

export type TileDefinition = {
  type: TileType;
  count: number; // copies in the game, the start tile included for D
  edges: [Edge, Edge, Edge, Edge]; // north, east, south, west
  cities: CityFeature[];
  roads: RoadFeature[];
  fields: FieldFeature[];
  monastery: boolean;
};

// A feature of one tile, by its kind and its index in that tile's list (always 0 for the monastery)
export type FeatureRef = { kind: FeatureKind; index: number };

export type Meeple = { seat: Seat; feature: FeatureRef };

// A tile on the board. x grows to the east and y to the south; the start tile is at 0, 0.
// `rotation` is the number of quarter turns clockwise. `by` is null for the start tile.
export type Placement = {
  x: number;
  y: number;
  tile: TileType;
  rotation: number;
  by: Seat | null;
  meeple: Meeple | null;
};

// One feature scored: what it was, how big, its points and who got them
export type ScoreEvent = {
  kind: FeatureKind;
  complete: boolean;
  tiles: number;
  points: number;
  seats: Seat[]; // the players with the most meeples on it, who each score the points; empty when nobody does
  meeples: Seat[]; // the meeples it had, one entry per meeple
};

// Points per seat at the end of the game for each kind of feature still on the board
export type FinalScores = Record<Seat, Record<FeatureKind, number>>;

export type Move =
  | { type: 'place'; x: number; y: number; rotation: number }
  | { type: 'meeple'; feature: FeatureRef | null }; // null places no meeple

// `discarded` are tiles drawn after the move that fit nowhere and left the game
export type LastMove =
  | { type: 'place'; playerNumber: Seat; tile: TileType; x: number; y: number; rotation: number }
  | { type: 'meeple'; playerNumber: Seat; feature: FeatureRef | null; scored: ScoreEvent[]; discarded: TileType[] };

// The full state, which never leaves the server: nobody sees the order of the tiles still to come
export type GameState = BaseGameState & {
  board: Placement[]; // in the order they were placed; the start tile first
  drawPile: TileType[]; // drawn from the end
  currentTile: TileType | null; // the drawn tile the current player must place; shown to everyone
  placed: boolean; // the current tile is on the board (the last placement) and its meeple is still to choose
  scores: Record<Seat, number>;
  discarded: TileType[]; // tiles that fit nowhere, out of the game
  finalScores: FinalScores | null; // the end-of-game scoring, once the game is over by placing the last tile
  finalEvents: ScoreEvent[]; // what the end-of-game scoring scored
  lastMove: LastMove | null;
};

export type PublicGameState = Omit<GameState, 'drawPile'> & BasePublicState & {
  tilesLeft: number; // tiles still to draw, not counting the current tile
};
