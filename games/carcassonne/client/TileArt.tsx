import { TILES } from '../tiles.ts';
import { SPOTS } from './spots.ts';
import type { Side, TileType } from '../types.ts';

// Each tile drawn from its data, 100 units square at the origin, then turned about its center:
// green field, sandy roads, walled cities, a pennant shield, and a monastery

const MIDS: Record<Side, [number, number]> = { 0: [50, 0], 1: [100, 50], 2: [50, 100], 3: [0, 50] };

function turned(path: string, quarterTurns: number) {
  return { d: path, transform: quarterTurns % 4 === 0 ? undefined : `rotate(${90 * (quarterTurns % 4)} 50 50)` };
}

// The outline of a city reaching these sides of the printed tile
function cityShape(sides: Side[]) {
  if (sides.length === 4) return turned('M0,0 H100 V100 H0 Z', 0);
  if (sides.length === 3) {
    const missing = ([0, 1, 2, 3] as Side[]).find(side => !sides.includes(side))!;
    return turned('M0,0 H100 V100 Q50,30 0,100 Z', (missing + 2) % 4);
  }
  if (sides.length === 2 && (sides[0] + 2) % 4 === sides[1]) {
    return turned('M0,0 Q50,70 100,0 V100 Q50,30 0,100 Z', (sides[0] + 3) % 4); // a band from west to east, turned
  }
  if (sides.length === 2) {
    const first = sides.find(side => sides.includes(((side + 1) % 4) as Side))!;
    return turned('M0,0 H100 Q25,25 0,100 Z', (first + 1) % 4); // across the north and west corner, turned
  }
  return turned('M0,0 H100 Q50,60 0,0 Z', sides[0]);
}

function roadPath(sides: Side[]): string {
  const [a, b] = sides.map(side => MIDS[side]);
  if (!b) return `M${a[0]},${a[1]} L50,50`;
  if ((sides[0] + 2) % 4 === sides[1]) return `M${a[0]},${a[1]} L${b[0]},${b[1]}`;
  return `M${a[0]},${a[1]} Q50,50 ${b[0]},${b[1]}`;
}

export function Pennant({ x, y }: { x: number; y: number }) {
  return (
    <g className="cc-pennant" transform={`translate(${x} ${y})`}>
      <path d="M-7,-8 H7 V0 Q7,6 0,9 Q-7,6 -7,0 Z" />
      <path className="cc-pennant-mark" d="M-3.5,-4 H3.5 M0,-6 V4" />
    </g>
  );
}

function Monastery() {
  return (
    <g className="cc-monastery">
      <path d="M33,62 V40 L50,26 L67,40 V62 Z" />
      <rect className="cc-monastery-door" x="45" y="48" width="10" height="14" rx="5" />
      <path className="cc-monastery-cross" d="M50,14 V26 M45,18 H55" />
    </g>
  );
}

export default function TileArt({ type, rotation }: { type: TileType; rotation: number }) {
  const tile = TILES[type];
  const spots = SPOTS[type];
  const junction = tile.roads.length >= 3;
  return (
    <g transform={rotation % 4 === 0 ? undefined : `rotate(${90 * rotation} 50 50)`}>
      <rect className="cc-field" width="100" height="100" />
      {tile.roads.map((road, index) => (
        <g key={`road-${index}`}>
          <path className="cc-road-edge" d={roadPath(road.sides)} />
          <path className="cc-road" d={roadPath(road.sides)} />
        </g>
      ))}
      {tile.cities.map((city, index) => {
        const shape = cityShape(city.sides);
        return <path key={`city-${index}`} className="cc-city" d={shape.d} transform={shape.transform} />;
      })}
      {junction && <rect className="cc-junction" x="41" y="41" width="18" height="18" rx="3" />}
      {tile.monastery && <Monastery />}
      {spots.pennant && (
        // The pennant stays upright: it is turned back by the tile's own turn
        <g transform={`rotate(${-90 * rotation} ${spots.pennant.x} ${spots.pennant.y})`}>
          <Pennant x={spots.pennant.x} y={spots.pennant.y} />
        </g>
      )}
      <rect className="cc-tile-edge" width="100" height="100" />
    </g>
  );
}
