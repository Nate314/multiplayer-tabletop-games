// Where the board's pieces are drawn, in SVG units, and the names and classes the screen shares
import { EDGES, HEX_VERTICES, VERTICES, hexCenter } from '../board.ts';
import type { SymbolColor } from '../../../src/components/colorSymbols.ts';
import type { DevCard, PortKind, Resource, Seat } from '../types.ts';

export const SCALE = 60; // SVG units per hex radius

export function vertexPoint(vertex: number): { x: number; y: number } {
  const { x, y } = VERTICES[vertex];
  return { x: x * SCALE, y: y * SCALE };
}

export function hexPoint(hex: number): { x: number; y: number } {
  const { x, y } = hexCenter(hex);
  return { x: x * SCALE, y: y * SCALE };
}

export function hexPolygon(hex: number): string {
  return HEX_VERTICES[hex].map(vertex => {
    const { x, y } = vertexPoint(vertex);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

export function edgeEnds(edge: number): [{ x: number; y: number }, { x: number; y: number }] {
  return [vertexPoint(EDGES[edge][0]), vertexPoint(EDGES[edge][1])];
}

// A port's marker sits out in the sea, off the middle of its coast edge
export function portPoint(edge: number): { x: number; y: number } {
  const [a, b] = edgeEnds(edge);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const hex = HEX_VERTICES.findIndex(corners => EDGES[edge].every(vertex => corners.includes(vertex)));
  const center = hexPoint(hex);
  const dx = mid.x - center.x;
  const dy = mid.y - center.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: mid.x + (dx / length) * SCALE * 0.6, y: mid.y + (dy / length) * SCALE * 0.6 };
}

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
export const SEAT_SYMBOLS: Record<Seat, SymbolColor> = { 1: 'red', 2: 'blue', 3: 'orange', 4: 'purple' };

export const seatClass = (seat: Seat) => `seat${seat}`;

export const robberKey = 'robber';
export const roadKey = (edge: number) => `road-${edge}`;
export const buildingKey = (vertex: number) => `building-${vertex}`;
