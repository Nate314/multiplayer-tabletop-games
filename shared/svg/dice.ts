import { el, svgDoc, type SvgAsset } from './svg.ts';

// The pips of a six-sided die. The face itself is the page element's background (.dice-die in src/App.scss), so a
// game's own die colors and outlines still apply; the pips paint with --dice-pip, which a game may set

// Pip positions on a 3 by 3 grid, numbered 0-8 from the top left
const PIPS: Record<string, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

const PIP_STYLE = 'fill: var(--dice-pip, var(--dice-pip-default, #1d1d1b))';

export function dieSvg(value: string): string | null {
  if (!Object.hasOwn(PIPS, value)) return null;
  return svgDoc('0 0 36 36', {},
    ...PIPS[value].map(spot => el('circle', { class: 'dice-pip', cx: 6 + (spot % 3) * 12, cy: 6 + Math.floor(spot / 3) * 12, r: 4, style: PIP_STYLE })));
}

export const DICE_ASSETS: SvgAsset[] = [
  { name: 'die', params: ['value'], samples: Object.keys(PIPS).map(value => [value]), render: ([value]) => dieSvg(value) },
];
