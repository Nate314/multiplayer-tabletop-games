// The base game board: 19 land hexes in rows of 3, 4, 5, 4 and 3, their 54 intersections (vertices) and 72 paths
// (edges), the standard resource and number token mix, and the 9 ports on the coast. The geometry is fixed; the
// resources, numbers and port kinds are shuffled each game.
import { shuffle } from '../../shared/shuffle.ts';
import type { Hex, Layout, PortKind, Random, Resource } from './types.ts';

export const RESOURCES: Resource[] = ['wood', 'brick', 'sheep', 'wheat', 'ore'];

export const RESOURCE_NAMES: Record<Resource, string> = {
  wood: 'wood', brick: 'brick', sheep: 'sheep', wheat: 'wheat', ore: 'ore'
};

// Hexes in axial coordinates (q, r), pointy side up, row by row from the top
export const HEX_COORDS: [number, number][] = [];
for (let r = -2; r <= 2; r++) {
  for (let q = -2; q <= 2; q++) if (Math.abs(q + r) <= 2) HEX_COORDS.push([q, r]);
}

const SQRT3 = Math.sqrt(3);

// A hex's centre, in hex radii from the middle of the board
export function hexCenter(hex: number): { x: number; y: number } {
  const [q, r] = HEX_COORDS[hex];
  return { x: SQRT3 * (q + r / 2), y: 1.5 * r };
}

// Corner k of a hex, clockwise from the top
function corner(hex: number, k: number): { x: number; y: number } {
  const { x, y } = hexCenter(hex);
  const angle = (Math.PI / 180) * (60 * k - 90);
  return { x: x + Math.cos(angle), y: y + Math.sin(angle) };
}

const pointKey = ({ x, y }: { x: number; y: number }) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`;

type Geometry = {
  vertices: { x: number; y: number }[]; // top to bottom, then left to right
  hexVertices: number[][]; // each hex's six corners, clockwise from the top
  edges: [number, number][]; // the two ends of each edge, lower vertex id first
};

function buildGeometry(): Geometry {
  const points = new Map<string, { x: number; y: number }>();
  for (let hex = 0; hex < HEX_COORDS.length; hex++) {
    for (let k = 0; k < 6; k++) {
      const point = corner(hex, k);
      points.set(pointKey(point), point);
    }
  }
  const vertices = [...points.values()].sort((a, b) => Math.round((a.y - b.y) * 1000) || a.x - b.x);
  const ids = new Map(vertices.map((point, id) => [pointKey(point), id]));
  const hexVertices = HEX_COORDS.map((_, hex) => Array.from({ length: 6 }, (_, k) => ids.get(pointKey(corner(hex, k))) as number));
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
  return { vertices, hexVertices, edges };
}

const GEOMETRY = buildGeometry();

export const VERTICES = GEOMETRY.vertices;
export const HEX_VERTICES = GEOMETRY.hexVertices;
export const EDGES = GEOMETRY.edges;
export const HEX_COUNT = HEX_COORDS.length;
export const VERTEX_COUNT = VERTICES.length;
export const EDGE_COUNT = EDGES.length;

// The hexes each vertex touches
export const VERTEX_HEXES: number[][] = VERTICES.map((_, vertex) =>
  HEX_VERTICES.flatMap((corners, hex) => corners.includes(vertex) ? [hex] : []));

// The edges at each vertex
export const VERTEX_EDGES: number[][] = VERTICES.map((_, vertex) =>
  EDGES.flatMap(([a, b], edge) => a === vertex || b === vertex ? [edge] : []));

// The vertices one edge away from each vertex
export const VERTEX_NEIGHBORS: number[][] = VERTEX_EDGES.map((edges, vertex) =>
  edges.map(edge => EDGES[edge][0] === vertex ? EDGES[edge][1] : EDGES[edge][0]));

// Hexes sharing a side
export const HEX_NEIGHBORS: number[][] = HEX_COORDS.map(([q, r]) =>
  HEX_COORDS.flatMap(([q2, r2], other) => {
    const dq = q2 - q;
    const dr = r2 - r;
    return Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr) === 2 ? [other] : [];
  }));

// Coast edges (on one hex only), going round the board clockwise from the top
const COAST: number[] = EDGES.map((_, edge) => edge)
  .filter(edge => HEX_VERTICES.filter(corners => EDGES[edge].every(v => corners.includes(v))).length === 1)
  .sort((a, b) => edgeAngle(a) - edgeAngle(b));

function edgeAngle(edge: number): number {
  const [a, b] = EDGES[edge];
  const x = (VERTICES[a].x + VERTICES[b].x) / 2;
  const y = (VERTICES[a].y + VERTICES[b].y) / 2;
  return (Math.atan2(x, -y) + 2 * Math.PI) % (2 * Math.PI);
}

// The printed frame's spacing: a port, then two or three coast edges without one, round all 30 coast edges
export const PORT_EDGES: number[] = [0, 3, 6, 10, 13, 16, 20, 23, 26].map(index => COAST[index]);

export const HEX_RESOURCES: (Resource | null)[] = [
  ...Array<Resource>(4).fill('wood'), ...Array<Resource>(4).fill('sheep'), ...Array<Resource>(4).fill('wheat'),
  ...Array<Resource>(3).fill('brick'), ...Array<Resource>(3).fill('ore'), null
];
export const NUMBER_TOKENS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
export const PORT_KINDS: PortKind[] = ['any', 'any', 'any', 'any', 'wood', 'brick', 'sheep', 'wheat', 'ore'];

const MAX_LAYOUT_TRIES = 1000; // a fair layout almost always turns up within a few tries

const isRed = (hex: Hex) => hex.number === 6 || hex.number === 8;

// True when no two hexes with a 6 or an 8 share a side
export function fairNumbers(hexes: Hex[]): boolean {
  return hexes.every((hex, index) => !isRed(hex) || HEX_NEIGHBORS[index].every(other => !isRed(hexes[other])));
}

// A random layout: resources and number tokens shuffled, drawn again until no 6 or 8 are neighbours, and the port kinds shuffled
export function randomLayout(random: Random): Layout {
  let hexes: Hex[] = [];
  for (let tries = 0; tries < MAX_LAYOUT_TRIES; tries++) {
    const resources = shuffle(HEX_RESOURCES, random);
    const numbers = shuffle(NUMBER_TOKENS, random);
    hexes = resources.map(resource => ({ resource, number: resource === null ? null : numbers.pop() ?? null }));
    if (fairNumbers(hexes)) break;
  }
  const kinds = shuffle(PORT_KINDS, random);
  return { hexes, ports: PORT_EDGES.map((edge, index) => ({ edge, kind: kinds[index] })) };
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
