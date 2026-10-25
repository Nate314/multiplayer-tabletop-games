// Where the board's pieces are drawn, in SVG units, and the names and classes the screen shares
import { BASE_BOARD, type Board } from '../board.ts';
import type { SymbolColor } from '../../../src/components/colorSymbols.ts';
import type { DevCard, PortKind, Resource, Seat } from '../types.ts';

export const SCALE = 60; // SVG units per hex radius

type Point = { x: number; y: number };

export function vertexPoint(board: Board, vertex: number): Point {
  const { x, y } = board.vertices[vertex];
  return { x: x * SCALE, y: y * SCALE };
}

export function hexPoint(board: Board, hex: number): Point {
  const { x, y } = board.centers[hex];
  return { x: x * SCALE, y: y * SCALE };
}

export function hexPolygon(board: Board, hex: number): string {
  return board.hexVertices[hex].map(vertex => {
    const { x, y } = vertexPoint(board, vertex);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

export function edgeEnds(board: Board, edge: number): [Point, Point] {
  return [vertexPoint(board, board.edges[edge][0]), vertexPoint(board, board.edges[edge][1])];
}

// A port's marker sits out in the sea, off the middle of its coast edge
export function portPoint(board: Board, edge: number): Point {
  const [a, b] = edgeEnds(board, edge);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const hex = board.hexVertices.findIndex(corners => board.edges[edge].every(vertex => corners.includes(vertex)));
  const center = hexPoint(board, hex);
  const dx = mid.x - center.x;
  const dy = mid.y - center.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: mid.x + (dx / length) * SCALE * 0.6, y: mid.y + (dy / length) * SCALE * 0.6 };
}

// The drawing's box and the sea round the island, a flat-topped hexagon as wide as the box
export function boardFrame(board: Board): { viewBox: string; sea: string } {
  const large = board.hexCount > BASE_BOARD.hexCount;
  const halfWidth = (large ? 6.2 : 5.3) * SCALE;
  const halfHeight = (large ? 6.8 : 5.3) * SCALE;
  const corner = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`;
  const sea = large
    ? [corner(halfWidth, 0), corner(halfWidth / 2, halfHeight * 0.98), corner(-halfWidth / 2, halfHeight * 0.98),
      corner(-halfWidth, 0), corner(-halfWidth / 2, -halfHeight * 0.98), corner(halfWidth / 2, -halfHeight * 0.98)]
    : Array.from({ length: 6 }, (_, k) => {
      const angle = (Math.PI / 3) * k;
      return corner(Math.cos(angle) * halfWidth, Math.sin(angle) * halfHeight * 0.98);
    });
  return { viewBox: `${-halfWidth} ${-halfHeight} ${halfWidth * 2} ${halfHeight * 2}`, sea: sea.join(' ') };
}

// The board area is taller than wide on the large board, so it gets its own size
export const boardAreaClass = (board: Board) => board.hexCount > BASE_BOARD.hexCount ? 'board-area board-area-large' : 'board-area';

export const RESOURCE_LABELS: Record<Resource, string> = {
  wood: 'Wood', brick: 'Brick', sheep: 'Sheep', wheat: 'Wheat', ore: 'Ore'
};

export const TERRAIN_LABELS: Record<Resource, string> = {
  wood: 'Forest', brick: 'Hills', sheep: 'Pasture', wheat: 'Fields', ore: 'Mountains'
};

export function portLabel(kind: PortKind): string {
  return kind === 'any' ? '3:1' : `2:1 ${RESOURCE_LABELS[kind]}`;
}

export const DEV_CARD_HELP: Record<DevCard, string> = {
  knight: 'Move the robber and steal a card. Counts toward Largest Army.',
  victoryPoint: 'One point. Kept hidden until the game ends.',
  roadBuilding: 'Place two roads for free.',
  yearOfPlenty: 'Take any two resources from the bank.',
  monopoly: 'Every other player gives you all their cards of one resource.'
};

// The color-blind symbol for each seat's color
export const SEAT_SYMBOLS: Record<Seat, SymbolColor> = { 1: 'red', 2: 'blue', 3: 'orange', 4: 'purple', 5: 'white', 6: 'green' };

export const seatClass = (seat: Seat) => `seat${seat}`;

export const robberKey = 'robber';
export const roadKey = (edge: number) => `road-${edge}`;
export const buildingKey = (vertex: number) => `building-${vertex}`;
