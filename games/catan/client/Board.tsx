import type { KeyboardEvent, ReactNode } from 'react';
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { pips } from '../board.ts';
import {
  RESOURCE_LABELS, SCALE, TERRAIN_LABELS, buildingKey, edgeEnds, hexPoint, hexPolygon, portLabel, portPoint, roadKey, robberKey,
  SEAT_SYMBOLS, seatClass, vertexPoint
} from './layout.ts';
import type { PublicGameState, Resource, Seat } from '../types.ts';

// What the player may click now; anything left out is not clickable
export type Targets = { vertices?: number[]; edges?: number[]; hexes?: number[] };

type BoardProps = {
  gameState: PublicGameState;
  targets?: Targets;
  onVertex?: (vertex: number) => void;
  onEdge?: (edge: number) => void;
  onHex?: (hex: number) => void;
};

const ROAD_SYMBOL = 9; // fits the 8 unit wide road
const BUILDING_SYMBOL = 9;

// A color symbol centered on a point of the drawing; the nested svg needs its size as attributes
function symbolAt(seat: Seat, x: number, y: number, size: number) {
  return <ColorSymbol color={SEAT_SYMBOLS[seat]} svgProps={{ x: x - size / 2, y: y - size / 2, width: size, height: size }} />;
}

const VIEW = 5.3 * SCALE; // half the width and height of the drawing, sea and ports included

// The sea is a flat-topped hexagon round the island, as wide as the drawing
const SEA = Array.from({ length: 6 }, (_, k) => {
  const angle = (Math.PI / 3) * k;
  return `${(Math.cos(angle) * VIEW).toFixed(1)},${(Math.sin(angle) * VIEW * 0.98).toFixed(1)}`;
}).join(' ');

const onKey = (action: () => void) => (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
};

// A small drawing of each terrain, above the number token
function Motif({ resource, x, y }: { resource: Resource | null; x: number; y: number }) {
  const at = (dx: number, dy: number) => `${x + dx},${y + dy}`;
  switch (resource) {
    case 'wood':
      return (
        <g className="motif motif-wood">
          {[-11, 0, 11].map(dx => <polygon key={dx} points={`${at(dx, -9)} ${at(dx - 6, 4)} ${at(dx + 6, 4)}`} />)}
        </g>
      );
    case 'brick':
      return (
        <g className="motif motif-brick">
          <rect x={x - 13} y={y - 7} width={12} height={6} />
          <rect x={x + 1} y={y - 7} width={12} height={6} />
          <rect x={x - 6} y={y} width={12} height={6} />
        </g>
      );
    case 'sheep':
      return (
        <g className="motif motif-sheep">
          <ellipse cx={x - 6} cy={y - 1} rx={8} ry={5} />
          <ellipse cx={x + 8} cy={y + 1} rx={6} ry={4} />
        </g>
      );
    case 'wheat':
      return (
        <g className="motif motif-wheat">
          {[-8, 0, 8].map(dx => <line key={dx} x1={x + dx} y1={y + 5} x2={x + dx} y2={y - 9} />)}
        </g>
      );
    case 'ore':
      return (
        <g className="motif motif-ore">
          <polygon points={`${at(-4, -10)} ${at(-15, 5)} ${at(7, 5)}`} />
          <polygon points={`${at(8, -5)} ${at(0, 5)} ${at(16, 5)}`} />
        </g>
      );
    default:
      return <path className="motif motif-desert" d={`M${x - 16},${y + 3} q8,-10 16,0 q8,-10 16,0`} />;
  }
}

function NumberToken({ number, x, y }: { number: number; x: number; y: number }) {
  const red = number === 6 || number === 8;
  const dots = pips(number);
  return (
    <g className={red ? 'token token-red' : 'token'}>
      <circle cx={x} cy={y} r={17} />
      <text x={x} y={y + 1} className="token-number">{number}</text>
      {Array.from({ length: dots }, (_, index) => (
        <circle key={index} className="token-pip" cx={x + (index - (dots - 1) / 2) * 4} cy={y + 11} r={1.4} />
      ))}
    </g>
  );
}

function Settlement({ x, y }: { x: number; y: number }) {
  return <polygon points={`${x},${y - 11} ${x + 9},${y - 3} ${x + 9},${y + 8} ${x - 9},${y + 8} ${x - 9},${y - 3}`} />;
}

function City({ x, y }: { x: number; y: number }) {
  return (
    <polygon points={`${x - 13},${y + 9} ${x - 13},${y - 4} ${x - 6},${y - 12} ${x + 1},${y - 4} ${x + 1},${y - 1} ${x + 13},${y - 1} ${x + 13},${y + 9}`} />
  );
}

// The island: hexes with their number tokens, ports, roads, settlements, cities and the robber, plus clickable targets
export default function Board({ gameState, targets = {}, onVertex, onEdge, onHex }: BoardProps) {
  const { layout, robber, roads, buildings, playerNames, activePlayers } = gameState;
  const pieceClass = (seat: Seat) => `${seatClass(seat)}${activePlayers.includes(seat) ? '' : ' piece-dead'}`;
  const hexTargets = new Set(targets.hexes ?? []);
  const items: ReactNode[] = [];

  layout.hexes.forEach((hex, index) => {
    const { x, y } = hexPoint(index);
    const label = hex.resource ? `${TERRAIN_LABELS[hex.resource]} (${RESOURCE_LABELS[hex.resource]}) ${hex.number}` : 'Desert';
    const clickable = hexTargets.has(index) && onHex;
    items.push(
      <g key={`hex-${index}`} className={`hex terrain-${hex.resource ?? 'desert'}${clickable ? ' hex-target' : ''}`}
        {...(clickable ? {
          role: 'button', tabIndex: 0, 'aria-label': `Move the robber to ${label}`,
          onClick: () => onHex(index), onKeyDown: onKey(() => onHex(index))
        } : {})}>
        <title>{label}</title>
        <polygon points={hexPolygon(index)} />
        <Motif resource={hex.resource} x={x} y={y - 30} />
        {hex.number !== null && <NumberToken number={hex.number} x={x} y={y + 4} />}
      </g>
    );
  });

  const ports = layout.ports.map(port => {
    const { x, y } = portPoint(port.edge);
    const [a, b] = edgeEnds(port.edge);
    return (
      <g key={`port-${port.edge}`} className={`port port-${port.kind}`}>
        <title>{`Port ${portLabel(port.kind)}`}</title>
        <line x1={x} y1={y} x2={a.x} y2={a.y} />
        <line x1={x} y1={y} x2={b.x} y2={b.y} />
        <circle cx={x} cy={y} r={15} />
        <text x={x} y={y - 2} className="port-ratio">{port.kind === 'any' ? '3:1' : '2:1'}</text>
        {port.kind !== 'any' && <text x={x} y={y + 8} className="port-resource">{RESOURCE_LABELS[port.kind]}</text>}
      </g>
    );
  });

  const roadLines = Object.keys(roads).map(Number).map(edge => {
    const [a, b] = edgeEnds(edge);
    return (
      <line key={`road-${edge}`} className={`road ${pieceClass(roads[edge])}`} data-anim-key={roadKey(edge)}
        x1={a.x} y1={a.y} x2={b.x} y2={b.y}>
        <title>{`${playerNames[roads[edge]]}'s road`}</title>
      </line>
    );
  });

  const roadSymbols = Object.keys(roads).map(Number).map(edge => {
    const [a, b] = edgeEnds(edge);
    return <g key={`road-symbol-${edge}`} className={`road-symbol ${pieceClass(roads[edge])}`}>{symbolAt(roads[edge], (a.x + b.x) / 2, (a.y + b.y) / 2, ROAD_SYMBOL)}</g>;
  });

  const edgeTargets = (onEdge ? targets.edges ?? [] : []).map(edge => {
    const [a, b] = edgeEnds(edge);
    const click = () => onEdge?.(edge);
    return (
      <g key={`edge-target-${edge}`} className="edge-target" role="button" tabIndex={0} aria-label={`Road at path ${edge}`}
        onClick={click} onKeyDown={onKey(click)}>
        <line className="edge-hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        <line className="edge-mark" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      </g>
    );
  });

  const pieces = Object.keys(buildings).map(Number).map(vertex => {
    const building = buildings[vertex];
    const { x, y } = vertexPoint(vertex);
    return (
      <g key={`building-${vertex}`} className={`building ${pieceClass(building.seat)}`} data-anim-key={buildingKey(vertex)}>
        <title>{`${playerNames[building.seat]}'s ${building.city ? 'city' : 'settlement'}`}</title>
        {building.city ? <City x={x} y={y} /> : <Settlement x={x} y={y} />}
        {building.city ? symbolAt(building.seat, x - 6, y + 4, BUILDING_SYMBOL) : symbolAt(building.seat, x, y + 2, BUILDING_SYMBOL)}
      </g>
    );
  });

  const vertexTargets = (onVertex ? targets.vertices ?? [] : []).map(vertex => {
    const { x, y } = vertexPoint(vertex);
    const click = () => onVertex?.(vertex);
    return (
      <circle key={`vertex-target-${vertex}`} className="vertex-target" cx={x} cy={y} r={9} role="button" tabIndex={0}
        aria-label={`Intersection ${vertex}`} onClick={click} onKeyDown={onKey(click)} />
    );
  });

  const robberAt = hexPoint(robber);

  return (
    <svg className="catan-board" viewBox={`${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`} role="img" aria-label="The island of Catan">
      <polygon className="sea" points={SEA} />
      {ports}
      {items}
      {roadLines}
      {roadSymbols}
      {edgeTargets}
      <g className="robber" data-anim-key={robberKey}>
        <title>The robber</title>
        <circle cx={robberAt.x + 22} cy={robberAt.y - 10} r={6} />
        <path d={`M${robberAt.x + 14},${robberAt.y + 16} q8,-28 16,0 z`} />
      </g>
      {pieces}
      {vertexTargets}
    </svg>
  );
}
