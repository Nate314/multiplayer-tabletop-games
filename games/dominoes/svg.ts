import { el, svgDoc, type SvgAsset } from '../../shared/svg/svg.ts';

// A domino's pips and center line, drawn on the server. The tile's face, edge and outlines stay on the page element
// (client/dominoes.scss), and the pips paint with its --tile-pip and --tile-edge

// Which of the nine spots in a half-tile hold a pip, for 0 to 9 pips (rows of three, left to right)
const SPOTS: number[][] = [
  [], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8],
  [0, 2, 3, 4, 5, 6, 8], [0, 1, 2, 3, 5, 6, 7, 8], [0, 1, 2, 3, 4, 5, 6, 7, 8]
];

const PIP = 'fill: var(--tile-pip, #1b1b1b)';

function half(pips: number, left: number): string {
  return SPOTS[pips].map(spot => el('circle', { cx: left + 10.5 + (spot % 3) * 10, cy: 10 + Math.floor(spot / 3) * 10, r: 3.4, style: PIP })).join('');
}

export function dominoSvg(left: string, right: string): string | null {
  if (!/^\d$/.test(left) || !/^\d$/.test(right)) return null;
  return svgDoc('0 0 82 40', {},
    half(Number(left), 0),
    el('line', { x1: 41, y1: 4, x2: 41, y2: 36, 'stroke-width': 2, 'stroke-opacity': 0.6, style: 'stroke: var(--tile-edge, #2b2b2b)' }),
    half(Number(right), 42));
}

export const DOMINOES_ASSETS: SvgAsset[] = [
  {
    name: 'domino',
    params: ['left pips', 'right pips'],
    samples: [['0', '0'], ['1', '2'], ['3', '4'], ['5', '6'], ['6', '6'], ['7', '8'], ['9', '9']],
    render: ([left, right]) => dominoSvg(left, right),
  },
];
