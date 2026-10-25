import { el, svgDoc, type SvgAsset } from './svg.ts';

// A round playing piece seen from above, lit from the top left: Checkers men, Connect Four discs, backgammon
// checkers, Mancala stones, Parchisi and Quoridor pawns, Splendor gems, Monopoly tokens and Risk's tray army. Each
// game colors it on the page element with --disc-fill, --disc-edge and --disc-edge-width (in hundredths of the
// piece's width), so one drawing serves every seat and theme
export function discSvg(): string {
  return svgDoc('0 0 100 100', {},
    el('circle', {
      cx: 50, cy: 50, r: 46,
      style: 'fill: var(--disc-fill, #9e9e9e); stroke: var(--disc-edge, rgba(0, 0, 0, 0.45)); stroke-width: var(--disc-edge-width, 6)',
    }),
    el('circle', { cx: 39, cy: 36, r: 22, fill: '#FFFFFF', 'fill-opacity': 0.28 }),
    el('path', { d: 'M18 68 A40 40 0 0 0 82 68', fill: 'none', stroke: '#000000', 'stroke-opacity': 0.18, 'stroke-width': 6, 'stroke-linecap': 'round' }));
}

export const DISC_ASSETS: SvgAsset[] = [{ name: 'disc', params: [], samples: [], render: discSvg }];
