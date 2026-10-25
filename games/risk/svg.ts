import { el, svgDoc, type SvgAsset } from '../../shared/svg/svg.ts';
import { CONTINENTS, MAP_HEIGHT, MAP_WIDTH, TERRITORIES } from './map.ts';
import type { ContinentId } from './types.ts';

// The world map's sea and land, drawn on the server; the territories, borders and labels on top stay in the client,
// where they can be clicked. The classes are the ones client/risk.scss colors

type Point = { x: number; y: number };

// The convex hull of a continent's territories, which the map draws with a wide round stroke as its land
function hull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: Point[]) => {
    const result: Point[] = [];
    for (const point of list) {
      while (result.length >= 2 && cross(result[result.length - 2], result[result.length - 1], point) <= 0) result.pop();
      result.push(point);
    }
    result.pop();
    return result;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

const CONTINENT_SHAPES: Record<ContinentId, string> = Object.fromEntries(CONTINENTS.map(({ id }) => {
  const points = hull(TERRITORIES.filter(territory => territory.continent === id));
  return [id, points.map(({ x, y }) => `${x},${y}`).join(' ')];
})) as Record<ContinentId, string>;

export function landSvg(): string {
  return svgDoc(`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`, {},
    el('rect', { class: 'sea', x: 0, y: 0, width: MAP_WIDTH, height: MAP_HEIGHT, rx: 12 }),
    ...CONTINENTS.map(({ id }) => el('g', { class: `continent continent-${id}` }, el('polygon', { class: 'land', points: CONTINENT_SHAPES[id] }))));
}

export const RISK_ASSETS: SvgAsset[] = [{ name: 'risk-land', params: [], samples: [], render: landSvg }];
