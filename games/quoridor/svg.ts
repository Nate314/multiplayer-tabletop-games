import { el, svgDoc, type SvgAsset } from '../../shared/svg/svg.ts';

// Quoridor's walls, drawn on the server and painted with client/quoridor.scss's --wall (the pawns are the shared disc)

// A wall stretches to its box (no aspect ratio), so one drawing serves both orientations, the preview and the tray.
// --qd-wall-fill lets the page recolor one wall, such as the last one placed
export function wallSvg(): string {
  return svgDoc('0 0 10 10', { preserveAspectRatio: 'none' },
    el('rect', { width: 10, height: 10, style: 'fill: var(--qd-wall-fill, var(--wall, #3E2723))' }));
}

export const QUORIDOR_ASSETS: SvgAsset[] = [
  { name: 'quoridor-wall', params: [], samples: [], render: wallSvg },
];
