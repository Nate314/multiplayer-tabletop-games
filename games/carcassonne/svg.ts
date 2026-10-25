import { el, svgDoc, type SvgAsset } from '../../shared/svg/svg.ts';
import { TILES } from './tiles.ts';
import { SPOTS } from './spots.ts';
import type { Side, TileType } from './types.ts';

// Carcassonne's tiles and meeples, drawn on the server. The parts carry the cc-* classes that
// client/carcassonne.scss colors, so the theme still paints them once inlined

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

function pennant(x: number, y: number): string {
  return el('g', { class: 'cc-pennant', transform: `translate(${x} ${y})` },
    el('path', { d: 'M-7,-8 H7 V0 Q7,6 0,9 Q-7,6 -7,0 Z' }),
    el('path', { class: 'cc-pennant-mark', d: 'M-3.5,-4 H3.5 M0,-6 V4' }));
}

function monastery(): string {
  return el('g', { class: 'cc-monastery' },
    el('path', { d: 'M33,62 V40 L50,26 L67,40 V62 Z' }),
    el('rect', { class: 'cc-monastery-door', x: 45, y: 48, width: 10, height: 14, rx: 5 }),
    el('path', { class: 'cc-monastery-cross', d: 'M50,14 V26 M45,18 H55' }));
}

// Each tile drawn from its data, 100 units square at the origin, then turned about its center:
// green field, sandy roads, walled cities, a pennant shield, and a monastery
export function tileSvg(type: string, quarterTurns: string): string | null {
  if (!Object.hasOwn(TILES, type) || !/^[0-3]$/.test(quarterTurns)) return null;
  const rotation = Number(quarterTurns);
  const tile = TILES[type as TileType];
  const spots = SPOTS[type as TileType];
  const parts = [
    el('rect', { class: 'cc-field', width: 100, height: 100 }),
    ...tile.roads.map(road => el('g', {},
      el('path', { class: 'cc-road-edge', d: roadPath(road.sides) }),
      el('path', { class: 'cc-road', d: roadPath(road.sides) }))),
    ...tile.cities.map(city => el('path', { class: 'cc-city', ...cityShape(city.sides) })),
  ];
  if (tile.roads.length >= 3) parts.push(el('rect', { class: 'cc-junction', x: 41, y: 41, width: 18, height: 18, rx: 3 }));
  if (tile.monastery) parts.push(monastery());
  // The pennant stays upright: it is turned back by the tile's own turn
  if (spots.pennant) parts.push(el('g', { transform: `rotate(${-90 * rotation} ${spots.pennant.x} ${spots.pennant.y})` }, pennant(spots.pennant.x, spots.pennant.y)));
  parts.push(el('rect', { class: 'cc-tile-edge', width: 100, height: 100 }));
  return svgDoc('0 0 100 100', {}, el('g', { class: 'cc-tile-art', transform: rotation === 0 ? undefined : `rotate(${90 * rotation} 50 50)` }, ...parts));
}

const MEEPLE = 'M0,-9 C3,-9 4,-7 4,-5 C4,-4 3.5,-3 3,-2.5 L8,-1 C9.5,-0.5 9.5,1.5 8,2 L4.5,2.5 L7,8 C7.3,9 6.5,9.5 5.5,9.5 ' +
  'L1.5,9.5 L0,6 L-1.5,9.5 L-5.5,9.5 C-6.5,9.5 -7.3,9 -7,8 L-4.5,2.5 L-8,2 C-9.5,1.5 -9.5,-0.5 -8,-1 L-3,-2.5 ' +
  'C-3.5,-3 -4,-4 -4,-5 C-4,-7 -3,-9 0,-9 Z';

// A meeple in the seat's color, centered in a 20 unit box; a farmer lies on its side, as the rules have it
export function meepleSvg(seat: string, pose: string): string | null {
  if (!/^[1-5]$/.test(seat) || (pose !== 'standing' && pose !== 'lying')) return null;
  return svgDoc('-10 -10 20 20', {}, el('path', { class: `cc-meeple cc-seat${seat}`, d: MEEPLE, transform: pose === 'lying' ? 'rotate(-90)' : undefined }));
}

const TILE_TYPES = Object.keys(TILES);

export const CARCASSONNE_ASSETS: SvgAsset[] = [
  {
    name: 'carcassonne-tile',
    params: ['tile type', 'quarter turns'],
    samples: [...TILE_TYPES.map(type => [type, '0']), ['D', '1'], ['F', '2'], ['S', '3']],
    render: ([type, turns]) => tileSvg(type, turns),
  },
  {
    name: 'carcassonne-meeple',
    params: ['seat', 'pose'],
    samples: [...['1', '2', '3', '4', '5'].map(seat => [seat, 'standing']), ['1', 'lying']],
    render: ([seat, pose]) => meepleSvg(seat, pose),
  },
];
