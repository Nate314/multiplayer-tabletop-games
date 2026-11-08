import { el, svgDoc, type SvgAsset } from '../../shared/svg/svg.ts';

// Rainbow Eights' card faces and back, drawn on the server: the card color (four quarters for a wild) and the upright circle in
// the middle, painted with client/rainboweights.scss's --card-* variables. The mark in the circle stays on the page

const COLORS: Record<string, string> = {
  red: 'var(--card-red, #d72600)',
  yellow: 'var(--card-yellow, #ecd407)',
  green: 'var(--card-green, #379711)',
  blue: 'var(--card-blue, #0956bf)',
};
const DARK = 'var(--card-dark, #1b1b1b)';

// The wild's quarters, clockwise from the top right, as its conic gradient had them
function quarters(): string {
  const corners = ['50,0 100,0 100,75', '100,75 100,150 50,150', '50,150 0,150 0,75', '0,75 0,0 50,0'];
  return [COLORS.red, COLORS.blue, COLORS.yellow, COLORS.green]
    .map((fill, i) => el('polygon', { points: `50,75 ${corners[i]}`, style: `fill: ${fill}` })).join('');
}

export function cardSvg(kind: string): string | null {
  let background: string;
  let circle = '#fff';
  if (Object.hasOwn(COLORS, kind)) background = el('rect', { width: 100, height: 150, style: `fill: ${COLORS[kind]}` });
  else if (kind === 'wild') background = quarters();
  else if (kind === 'back') {
    background = el('rect', { width: 100, height: 150, style: `fill: ${DARK}` });
    circle = COLORS.red;
  } else return null;
  return svgDoc('0 0 100 150', {}, background,
    el('circle', { cx: 50, cy: 75, r: 36, style: `fill: ${circle}` }));
}

export const RAINBOWEIGHTS_ASSETS: SvgAsset[] = [
  { name: 'rainboweights-card', params: ['color, wild or back'], samples: [...Object.keys(COLORS), 'wild', 'back'].map(kind => [kind]), render: ([kind]) => cardSvg(kind) },
];
