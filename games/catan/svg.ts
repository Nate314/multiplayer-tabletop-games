import { el, svgDoc, type SvgAsset } from '../../shared/svg/svg.ts';

// Catan's terrain motifs, settlement, city and robber, drawn on the server in a 40 unit box centered on the point
// they stand on. The board places them inside its own SVG, where clicks still reach the hex; the parts carry the
// classes client/catan.scss colors (motif-*, and the seat color of the building group they sit in)

const at = (dx: number, dy: number) => `${dx},${dy}`;

const MOTIFS: Record<string, () => string> = {
  wood: () => el('g', { class: 'motif motif-wood' }, ...[-11, 0, 11].map(dx => el('polygon', { points: `${at(dx, -9)} ${at(dx - 6, 4)} ${at(dx + 6, 4)}` }))),
  brick: () => el('g', { class: 'motif motif-brick' },
    el('rect', { x: -13, y: -7, width: 12, height: 6 }),
    el('rect', { x: 1, y: -7, width: 12, height: 6 }),
    el('rect', { x: -6, y: 0, width: 12, height: 6 })),
  sheep: () => el('g', { class: 'motif motif-sheep' },
    el('ellipse', { cx: -6, cy: -1, rx: 8, ry: 5 }),
    el('ellipse', { cx: 8, cy: 1, rx: 6, ry: 4 })),
  wheat: () => el('g', { class: 'motif motif-wheat' }, ...[-8, 0, 8].map(dx => el('line', { x1: dx, y1: 5, x2: dx, y2: -9 }))),
  ore: () => el('g', { class: 'motif motif-ore' },
    el('polygon', { points: `${at(-4, -10)} ${at(-15, 5)} ${at(7, 5)}` }),
    el('polygon', { points: `${at(8, -5)} ${at(0, 5)} ${at(16, 5)}` })),
  desert: () => el('path', { class: 'motif motif-desert', d: 'M-16,3 q8,-10 16,0 q8,-10 16,0' }),
};

const PIECES: Record<string, () => string> = {
  settlement: () => el('polygon', { points: '0,-11 9,-3 9,8 -9,8 -9,-3' }),
  city: () => el('polygon', { points: '-13,9 -13,-4 -6,-12 1,-4 1,-1 13,-1 13,9' }),
  robber: () => el('g', { class: 'robber-figure' }, el('circle', { cx: 0, cy: -10, r: 6 }), el('path', { d: 'M-8,16 q8,-28 16,0 z' })),
};

// The gray fill is only for the gallery: on the board the seat's color and the robber's colors replace it
const box = (body: string) => svgDoc('-20 -20 40 40', { fill: '#9e9e9e' }, body);

export function motifSvg(terrain: string): string | null {
  return Object.hasOwn(MOTIFS, terrain) ? box(MOTIFS[terrain]()) : null;
}

export function pieceSvg(piece: string): string | null {
  return Object.hasOwn(PIECES, piece) ? box(PIECES[piece]()) : null;
}

export const CATAN_ASSETS: SvgAsset[] = [
  { name: 'catan-motif', params: ['terrain'], samples: Object.keys(MOTIFS).map(terrain => [terrain]), render: ([terrain]) => motifSvg(terrain) },
  { name: 'catan-piece', params: ['piece'], samples: Object.keys(PIECES).map(piece => [piece]), render: ([piece]) => pieceSvg(piece) },
];
