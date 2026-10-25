import { el, escapeText, svgDoc, type SvgAsset } from '../../shared/svg/svg.ts';

// Azul's tiles and the first player marker, drawn on the server. The page keeps each tile's border, outline and
// clipping (client/azul.scss); with Color-blind symbols on, the page asks for the plain tile and lays the shared shape
// over it, so colors are never told apart by hue alone

// Each color has its own mark, so colors are not told apart by hue alone
const TILES: Record<string, { fill: string; ink: string; mark: string }> = {
  blue: { fill: '#1e6fd9', ink: '#fff', mark: '◆' },
  yellow: { fill: '#f2b61b', ink: '#3a2a00', mark: '●' },
  red: { fill: '#d6392e', ink: '#fff', mark: '▲' },
  black: { fill: '#2b2b2b', ink: '#fff', mark: '■' },
  cyan: { fill: '#7fdcdf', ink: '#053a3c', mark: '✚' },
  first: { fill: '#fff', ink: '#1c2b3a', mark: '1' },
};

export function tileSvg(kind: string, style: string): string | null {
  if (!Object.hasOwn(TILES, kind) || (style !== 'mark' && style !== 'plain')) return null;
  const { fill, ink, mark } = TILES[kind];
  const parts = [
    el('rect', { width: 40, height: 40, fill }),
    // The inner glaze along the edge
    el('rect', { x: 2, y: 2, width: 36, height: 36, rx: 3, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.25, 'stroke-width': 2 }),
  ];
  if (style === 'mark') {
    parts.push(el('text', { x: 20, y: 21, 'font-size': 20, 'font-weight': kind === 'first' ? 700 : undefined, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: ink }, escapeText(mark)));
  }
  return svgDoc('0 0 40 40', {}, ...parts);
}

export const AZUL_ASSETS: SvgAsset[] = [
  {
    name: 'azul-tile',
    params: ['kind', 'mark or plain'],
    samples: [...Object.keys(TILES).map(kind => [kind, 'mark']), ['blue', 'plain']],
    render: ([kind, style]) => tileSvg(kind, style),
  },
];
