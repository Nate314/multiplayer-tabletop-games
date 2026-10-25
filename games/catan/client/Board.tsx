import type { KeyboardEvent, ReactNode } from 'react';
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { boardOf, pips } from '../board.ts';
import {
  RESOURCE_LABELS, SEAT_SYMBOLS, TERRAIN_LABELS, boardFrame, buildingKey, edgeEnds, hexPoint, hexPolygon, portLabel, portPoint, roadKey,
  robberKey, seatClass, vertexPoint
} from './layout.ts';
import type { PublicGameState, Resource, Seat } from '../types.ts';
import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import { svgUrl } from '../../../src/assets/svgCache.ts';
import usePreloadSvgs from '../../../src/assets/usePreloadSvgs.ts';

// What the player may click now; anything left out is not clickable
export type Targets = { vertices?: number[]; edges?: number[]; hexes?: number[] };

type BoardProps = {
  gameState: PublicGameState;
  targets?: Targets;
  onVertex?: (vertex: number) => void;
  onEdge?: (edge: number) => void;
  onHex?: (hex: number) => void;
};

const ROAD_SYMBOL = 10; // a little wider than the 8 unit road, so it reads when the board is small
const BUILDING_SYMBOL = 11; // fills a settlement's body or a city's tower

// A color symbol centered on a point of the drawing; the nested svg needs its size as attributes
function symbolAt(seat: Seat, x: number, y: number, size: number) {
  return <ColorSymbol color={SEAT_SYMBOLS[seat]} svgProps={{ x: x - size / 2, y: y - size / 2, width: size, height: size }} />;
}

const onKey = (action: () => void) => (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
};

// A drawing from games/catan/svg.ts, 40 units square, centered on x, y
function Drawn({ url, x, y }: { url: string; x: number; y: number }) {
  return <ServerSvg url={url} inSvg svgProps={{ x: x - 20, y: y - 20, width: 40, height: 40 }} />;
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

const CATAN_PIECES = [
  ...['wood', 'brick', 'sheep', 'wheat', 'ore', 'desert'].map(terrain => svgUrl('catan-motif', terrain)),
  ...['settlement', 'city', 'robber'].map(piece => svgUrl('catan-piece', piece)),
];

// The island: hexes with their number tokens, ports, roads, settlements, cities and the robber, plus clickable targets
export default function Board({ gameState, targets = {}, onVertex, onEdge, onHex }: BoardProps) {
  usePreloadSvgs(CATAN_PIECES);
  const board = boardOf(gameState.layout);
  const { viewBox, sea } = boardFrame(board);
  const { layout, robber, roads, buildings, playerNames, activePlayers } = gameState;
  const pieceClass = (seat: Seat) => `${seatClass(seat)}${activePlayers.includes(seat) ? '' : ' piece-dead'}`;
  const hexTargets = new Set(targets.hexes ?? []);
  const items: ReactNode[] = [];

  layout.hexes.forEach((hex, index) => {
    const { x, y } = hexPoint(board, index);
    const label = hex.resource ? `${TERRAIN_LABELS[hex.resource]} (${RESOURCE_LABELS[hex.resource]}) ${hex.number}` : 'Desert';
    const clickable = hexTargets.has(index) && onHex;
    items.push(
      <g key={`hex-${index}`} className={`hex terrain-${hex.resource ?? 'desert'}${clickable ? ' hex-target' : ''}`}
        {...(clickable ? {
          role: 'button', tabIndex: 0, 'aria-label': `Move the robber to ${label}`,
          onClick: () => onHex(index), onKeyDown: onKey(() => onHex(index))
        } : {})}>
        <title>{label}</title>
        <polygon points={hexPolygon(board, index)} />
        <Drawn url={svgUrl('catan-motif', hex.resource ?? 'desert')} x={x} y={y - 30} />
        {hex.number !== null && <NumberToken number={hex.number} x={x} y={y + 4} />}
      </g>
    );
  });

  const ports = layout.ports.map(port => {
    const { x, y } = portPoint(board, port.edge);
    const [a, b] = edgeEnds(board, port.edge);
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
    const [a, b] = edgeEnds(board, edge);
    return (
      <line key={`road-${edge}`} className={`road ${pieceClass(roads[edge])}`} data-anim-key={roadKey(edge)}
        x1={a.x} y1={a.y} x2={b.x} y2={b.y}>
        <title>{`${playerNames[roads[edge]]}'s road`}</title>
      </line>
    );
  });

  const roadSymbols = Object.keys(roads).map(Number).map(edge => {
    const [a, b] = edgeEnds(board, edge);
    return <g key={`road-symbol-${edge}`} className={`road-symbol ${pieceClass(roads[edge])}`}>{symbolAt(roads[edge], (a.x + b.x) / 2, (a.y + b.y) / 2, ROAD_SYMBOL)}</g>;
  });

  const edgeTargets = (onEdge ? targets.edges ?? [] : []).map(edge => {
    const [a, b] = edgeEnds(board, edge);
    const click = () => onEdge?.(edge);
    return (
      <g key={`edge-target-${edge}`} className="edge-target" data-drop={`edge-${edge}`} role="button" tabIndex={0} aria-label={`Road at path ${edge}`}
        onClick={click} onKeyDown={onKey(click)}>
        <line className="edge-hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        <line className="edge-mark" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      </g>
    );
  });

  const pieces = Object.keys(buildings).map(Number).map(vertex => {
    const building = buildings[vertex];
    const { x, y } = vertexPoint(board, vertex);
    return (
      <g key={`building-${vertex}`} className={`building ${pieceClass(building.seat)}`} data-anim-key={buildingKey(vertex)}>
        <title>{`${playerNames[building.seat]}'s ${building.city ? 'city' : 'settlement'}`}</title>
        <Drawn url={svgUrl('catan-piece', building.city ? 'city' : 'settlement')} x={x} y={y} />
        {building.city ? symbolAt(building.seat, x - 6, y + 3, BUILDING_SYMBOL) : symbolAt(building.seat, x, y + 2.5, BUILDING_SYMBOL)}
      </g>
    );
  });

  const vertexTargets = (onVertex ? targets.vertices ?? [] : []).map(vertex => {
    const { x, y } = vertexPoint(board, vertex);
    const click = () => onVertex?.(vertex);
    // The drop target is the group, so a drop lands within the larger invisible circle, which a finger can hit on a phone
    return (
      <g key={`vertex-target-${vertex}`} className="vertex-drop" data-drop={`vertex-${vertex}`}>
        <circle className="vertex-hit" cx={x} cy={y} r={18} />
        <circle className="vertex-target" cx={x} cy={y} r={9} role="button" tabIndex={0}
          aria-label={`Intersection ${vertex}`} onClick={click} onKeyDown={onKey(click)} />
      </g>
    );
  });

  const robberAt = hexPoint(board, robber);

  return (
    <svg className="catan-board" viewBox={viewBox} role="img" aria-label="The island of Catan">
      <polygon className="sea" points={sea} />
      {ports}
      {items}
      {roadLines}
      {roadSymbols}
      {edgeTargets}
      <g className="robber" data-anim-key={robberKey}>
        <title>The robber</title>
        <Drawn url={svgUrl('catan-piece', 'robber')} x={robberAt.x + 22} y={robberAt.y} />
      </g>
      {pieces}
      {vertexTargets}
    </svg>
  );
}
