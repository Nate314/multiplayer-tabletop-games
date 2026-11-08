// The game boards: the base 19 land hexes in rows of 3, 4, 5, 4 and 3, and the 5-6 player extension's 30, each with its
// intersections (vertices), paths (edges), the standard resource and number token mix, and the ports on the coast.
// The geometry is fixed; the resources, numbers and port kinds are shuffled each game.
import { shuffle } from '../../shared/shuffle.ts';
import type { Hex, Layout, PortKind, Random, Resource } from './types.ts';

export const RESOURCES: Resource[] = ['wood', 'brick', 'sheep', 'wheat', 'ore'];

const SQRT3 = Math.sqrt(3);

type Point = { x: number; y: number };

export type Board = {
  hexCount: number; vertexCount: number; edgeCount: number;
  centers: Point[]; // hex centres in hex radii, the drawing centred on (0, 0)
  vertices: Point[]; // top to bottom, then left to right
  hexVertices: number[][]; // each hex's six corners, clockwise from the top
  edges: [number, number][]; // the two ends of each edge, lower vertex id first
  vertexHexes: number[][]; vertexEdges: number[][]; vertexNeighbors: number[][]; hexNeighbors: number[][];
  portEdges: number[];
  hexResources: (Resource | null)[]; numberTokens: number[]; portKinds: PortKind[];
};

const pointKey = ({ x, y }: Point) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`;

// Builds a board from hexes in axial coordinates (q, r), pointy side up, row by row from the top
function buildBoard(
  coords: [number, number][],
  contents: Pick<Board, 'hexResources' | 'numberTokens' | 'portKinds'>,
  portIndexes: number[]
): Board {
  const raw = coords.map(([q, r]) => ({ x: SQRT3 * (q + r / 2), y: 1.5 * r }));
  const xs = raw.map(point => point.x);
  const shift = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centers = raw.map(({ x, y }) => ({ x: x - shift, y }));

  // Corner k of a hex, clockwise from the top
  const corner = (hex: number, k: number): Point => {
    const angle = (Math.PI / 180) * (60 * k - 90);
    return { x: centers[hex].x + Math.cos(angle), y: centers[hex].y + Math.sin(angle) };
  };

  const points = new Map<string, Point>();
  for (let hex = 0; hex < coords.length; hex++) {
    for (let k = 0; k < 6; k++) {
      const point = corner(hex, k);
      points.set(pointKey(point), point);
    }
  }
  const vertices = [...points.values()].sort((a, b) => Math.round((a.y - b.y) * 1000) || a.x - b.x);
  const ids = new Map(vertices.map((point, id) => [pointKey(point), id]));
  const hexVertices = coords.map((_, hex) => Array.from({ length: 6 }, (_, k) => ids.get(pointKey(corner(hex, k))) as number));
  const edgeKeys = new Map<string, [number, number]>();
  for (const corners of hexVertices) {
    for (let k = 0; k < 6; k++) {
      const a = corners[k];
      const b = corners[(k + 1) % 6];
      const pair: [number, number] = a < b ? [a, b] : [b, a];
      edgeKeys.set(pair.join('-'), pair);
    }
  }
  const edges = [...edgeKeys.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  // The hexes each vertex touches
  const vertexHexes = vertices.map((_, vertex) =>
    hexVertices.flatMap((corners, hex) => corners.includes(vertex) ? [hex] : []));
  // The edges at each vertex
  const vertexEdges = vertices.map((_, vertex) =>
    edges.flatMap(([a, b], edge) => a === vertex || b === vertex ? [edge] : []));
  // The vertices one edge away from each vertex
  const vertexNeighbors = vertexEdges.map((around, vertex) =>
    around.map(edge => edges[edge][0] === vertex ? edges[edge][1] : edges[edge][0]));
  // Hexes sharing a side
  const hexNeighbors = coords.map(([q, r]) =>
    coords.flatMap(([q2, r2], other) => {
      const dq = q2 - q;
      const dr = r2 - r;
      return Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr) === 2 ? [other] : [];
    }));

  // Coast edges (on one hex only), going round the board clockwise from the top
  const edgeAngle = (edge: number): number => {
    const [a, b] = edges[edge];
    const x = (vertices[a].x + vertices[b].x) / 2;
    const y = (vertices[a].y + vertices[b].y) / 2;
    return (Math.atan2(x, -y) + 2 * Math.PI) % (2 * Math.PI);
  };
  const coast = edges.map((_, edge) => edge)
    .filter(edge => hexVertices.filter(corners => edges[edge].every(v => corners.includes(v))).length === 1)
    .sort((a, b) => edgeAngle(a) - edgeAngle(b));

  return {
    hexCount: coords.length, vertexCount: vertices.length, edgeCount: edges.length,
    centers, vertices, hexVertices, edges, vertexHexes, vertexEdges, vertexNeighbors, hexNeighbors,
    portEdges: portIndexes.map(index => coast[index]),
    ...contents
  };
}

// Hexes row by row from the top, each row given as [r, first q, last q]
const rows = (spans: [number, number, number][]): [number, number][] =>
  spans.flatMap(([r, from, to]) => Array.from({ length: to - from + 1 }, (_, i): [number, number] => [from + i, r]));

const ofKind = (count: number, kind: Resource): Resource[] => Array<Resource>(count).fill(kind);

// The printed frame's spacing: a port, then two or three coast edges without one, round all 30 coast edges
export const BASE_BOARD: Board = buildBoard(
  rows([[-2, 0, 2], [-1, -1, 2], [0, -2, 2], [1, -2, 1], [2, -2, 0]]),
  {
    hexResources: [...ofKind(4, 'wood'), ...ofKind(4, 'sheep'), ...ofKind(4, 'wheat'), ...ofKind(3, 'brick'), ...ofKind(3, 'ore'), null],
    numberTokens: [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],
    portKinds: ['any', 'any', 'any', 'any', 'wood', 'brick', 'sheep', 'wheat', 'ore']
  },
  [0, 3, 6, 10, 13, 16, 20, 23, 26]
);

// The 5-6 player extension: 30 hexes and 11 ports round 38 coast edges
export const FIVE_SIX_BOARD: Board = buildBoard(
  rows([[-3, 0, 2], [-2, -1, 2], [-1, -2, 2], [0, -3, 2], [1, -3, 1], [2, -3, 0], [3, -3, -1]]),
  {
    hexResources: [...ofKind(6, 'wood'), ...ofKind(6, 'sheep'), ...ofKind(6, 'wheat'), ...ofKind(5, 'brick'), ...ofKind(5, 'ore'), null, null],
    numberTokens: [2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12],
    portKinds: ['any', 'any', 'any', 'any', 'any', 'wood', 'brick', 'sheep', 'sheep', 'wheat', 'ore']
  },
  [0, 3, 7, 10, 14, 17, 21, 24, 28, 31, 35]
);

export const boardOf = (layout: Pick<Layout, 'hexes'>): Board =>
  layout.hexes.length === FIVE_SIX_BOARD.hexCount ? FIVE_SIX_BOARD : BASE_BOARD;

// The base board under its old names, for tests; rules code reads boardOf(state.layout)
export const HEX_COUNT = BASE_BOARD.hexCount;
export const VERTEX_COUNT = BASE_BOARD.vertexCount;
export const EDGE_COUNT = BASE_BOARD.edgeCount;
export const VERTICES = BASE_BOARD.vertices;
export const HEX_VERTICES = BASE_BOARD.hexVertices;
export const EDGES = BASE_BOARD.edges;
export const VERTEX_HEXES = BASE_BOARD.vertexHexes;
export const VERTEX_EDGES = BASE_BOARD.vertexEdges;
export const VERTEX_NEIGHBORS = BASE_BOARD.vertexNeighbors;
export const HEX_NEIGHBORS = BASE_BOARD.hexNeighbors;
export const PORT_EDGES = BASE_BOARD.portEdges;
export const HEX_RESOURCES = BASE_BOARD.hexResources;
export const NUMBER_TOKENS = BASE_BOARD.numberTokens;
export const PORT_KINDS = BASE_BOARD.portKinds;

const MAX_LAYOUT_TRIES = 1000; // a fair layout almost always turns up within a few tries

const isRed = (hex: Hex) => hex.number === 6 || hex.number === 8;

// True when no two hexes with a 6 or an 8 share a side
export function fairNumbers(hexes: Hex[]): boolean {
  const neighbors = boardOf({ hexes }).hexNeighbors;
  return hexes.every((hex, index) => !isRed(hex) || neighbors[index].every(other => !isRed(hexes[other])));
}

// A random layout: resources and number tokens shuffled, drawn again until no 6 or 8 are neighbours, and the port kinds shuffled
export function randomLayout(random: Random, board: Board = BASE_BOARD): Layout {
  let hexes: Hex[] = [];
  for (let tries = 0; tries < MAX_LAYOUT_TRIES; tries++) {
    const resources = shuffle(board.hexResources, random);
    const numbers = shuffle(board.numberTokens, random);
    hexes = resources.map(resource => ({ resource, number: resource === null ? null : numbers.pop() ?? null }));
    if (fairNumbers(hexes)) break;
  }
  const kinds = shuffle(board.portKinds, random);
  return { hexes, ports: board.portEdges.map((edge, index) => ({ edge, kind: kinds[index] })) };
}

export function desertOf(layout: Layout): number {
  return Math.max(0, layout.hexes.findIndex(hex => hex.resource === null));
}

// How many dots a number token shows: the ways two dice can roll it
export function pips(number: number): number {
  return 6 - Math.abs(7 - number);
}

export const isIndex = (value: unknown, size: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < size;
