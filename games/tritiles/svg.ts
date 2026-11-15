import { el, svgDoc, type SvgAsset } from '../../shared/svg/svg.ts';

// A Tri-Tiles tile's corner numbers, drawn on the server. The triangle's face and outline stay on the page element,
// and the numbers paint with its --tile-pip

// Each tile's corners in clockwise order: the numbers sit just inside their corner
const CORNERS = {
  up: [[50, 38], [76, 76], [24, 76]],
  down: [[24, 24], [76, 24], [50, 62]]
};

export function triTileSvg(a: string, b: string, c: string, up: string): string | null {
  const numbers = [a, b, c];
  if (!numbers.every(n => /^[0-5]$/.test(n)) || (up !== 'up' && up !== 'down')) return null;
  return svgDoc('0 0 100 90', {},
    ...numbers.map((n, i) => el('text', {
      x: CORNERS[up][i][0], y: CORNERS[up][i][1], 'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': 22, 'font-weight': 700, style: 'fill: var(--tile-pip, #1b1b1b)'
    }, n)));
}

export const TRITILES_ASSETS: SvgAsset[] = [
  {
    name: 'tritile',
    params: ['corner 1', 'corner 2', 'corner 3', 'orientation (up or down)'],
    samples: [['0', '0', '0', 'up'], ['1', '2', '3', 'up'], ['0', '4', '5', 'down'], ['5', '5', '5', 'down']],
    render: ([a, b, c, up]) => triTileSvg(a, b, c, up),
  },
];
