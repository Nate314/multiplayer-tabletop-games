import { el, svgDoc, type SvgAsset } from '../../shared/svg/svg.ts';

// The chess pieces as shapes in a 45 unit box, drawn on the server (they were Unicode glyphs, which every phone font
// draws differently). White pieces have a dark outline and black pieces a light one, so both read on either square

const BASE = el('rect', { x: 11, y: 36, width: 23, height: 4.5, rx: 1.5 });

const SHAPES: Record<string, (edge: string) => string[]> = {
  pawn: () => [
    el('path', { d: 'M15.5 36 C15.5 29 18.5 25 20 21.5 H25 C26.5 25 29.5 29 29.5 36 Z' }),
    el('ellipse', { cx: 22.5, cy: 21, rx: 5.5, ry: 1.8 }),
    el('circle', { cx: 22.5, cy: 14, r: 5.5 }),
    BASE,
  ],
  rook: () => [
    el('path', { d: 'M14 36 L15.5 18 H29.5 L31 36 Z' }),
    el('path', { d: 'M12.5 18 V9.5 H16.5 V12.5 H20.5 V9.5 H24.5 V12.5 H28.5 V9.5 H32.5 V18 Z' }),
    BASE,
  ],
  knight: edge => [
    el('path', { d: 'M14 36.5 L15 30 C15 26 18 23 20 21 C17 21.5 13.5 23.5 11.5 21.5 C9.5 19.5 12.5 14.5 16 11.5 L16.5 7 L19.5 10 L21 6.5 L23 10 C30 11 33.5 18 32.5 26 L31.5 36.5 Z' }),
    el('circle', { cx: 19, cy: 14.5, r: 1.2, fill: edge }),
    BASE,
  ],
  bishop: edge => [
    el('path', { d: 'M15 36 C15 30 18 27.5 19 24.5 H26 C27 27.5 30 30 30 36 Z' }),
    el('path', { d: 'M22.5 8.5 C17 13 16 18.5 18.5 24 H26.5 C29 18.5 28 13 22.5 8.5 Z' }),
    el('circle', { cx: 22.5, cy: 6.5, r: 2.2 }),
    el('path', { d: 'M24.5 13 L20.5 18', fill: 'none', stroke: edge }),
    BASE,
  ],
  queen: () => [
    el('path', { d: 'M13 36 L11 14.5 L16.5 25 L16.5 11.5 L20.5 23 L22.5 10 L24.5 23 L28.5 11.5 L28.5 25 L34 14.5 L32 36 Z' }),
    ...[[11, 13], [16.5, 10], [22.5, 8.5], [28.5, 10], [34, 13]].map(([cx, cy]) => el('circle', { cx, cy, r: 2.2 })),
    BASE,
  ],
  king: () => [
    el('path', { d: 'M13 36 C12 30 11 24.5 14 21 C17 18 20 19.5 22.5 23 C25 19.5 28 18 31 21 C34 24.5 33 30 32 36 Z' }),
    el('path', { d: 'M21 5 H24 V8.5 H27.5 V11.5 H24 V18 H21 V11.5 H17.5 V8.5 H21 Z' }),
    BASE,
  ],
};

const COLORS: Record<string, { fill: string; edge: string }> = {
  white: { fill: '#FFFFFF', edge: '#000000' },
  black: { fill: '#1A1A1A', edge: 'rgba(255, 255, 255, 0.9)' },
};

export function pieceSvg(color: string, type: string): string | null {
  if (!Object.hasOwn(COLORS, color) || !Object.hasOwn(SHAPES, type)) return null;
  const { fill, edge } = COLORS[color];
  return svgDoc('0 0 45 45', { fill, stroke: edge, 'stroke-width': 1.5, 'stroke-linejoin': 'round' },
    ...SHAPES[type](edge));
}

export const CHESS_ASSETS: SvgAsset[] = [
  {
    name: 'chess-piece',
    params: ['color', 'type'],
    samples: Object.keys(COLORS).flatMap(color => Object.keys(SHAPES).map(type => [color, type])),
    render: ([color, type]) => pieceSvg(color, type),
  },
];
