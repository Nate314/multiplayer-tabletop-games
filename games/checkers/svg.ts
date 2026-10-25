import { el, svgDoc, type SvgAsset } from '../../shared/svg/svg.ts';

// The crown on a king, drawn on the server over the shared disc, in --crown from client/checkers.scss
export function crownSvg(): string {
  return svgDoc('0 0 40 40', {},
    el('path', {
      d: 'M6 30 L4 12 L13 20 L20 8 L27 20 L36 12 L34 30 Z',
      'stroke-width': 2, 'stroke-linejoin': 'round',
      style: 'fill: var(--crown, #FFD54F); stroke: rgba(0, 0, 0, 0.55)',
    }),
    el('rect', { x: 6, y: 31, width: 28, height: 4, rx: 1, style: 'fill: var(--crown, #FFD54F); stroke: rgba(0, 0, 0, 0.55)', 'stroke-width': 1.5 }));
}

export const CHECKERS_ASSETS: SvgAsset[] = [{ name: 'checkers-crown', params: [], samples: [], render: crownSvg }];
