import { el, svgDoc, type SvgAsset } from '../../shared/svg/svg.ts';

// UNO's card faces and back, drawn on the server: the card color (four quarters for a wild) and the tilted oval in
// the middle, painted with client/uno.scss's --card-* variables. The mark on the oval stays on the page

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
  let oval = '#fff';
  if (Object.hasOwn(COLORS, kind)) background = el('rect', { width: 100, height: 150, style: `fill: ${COLORS[kind]}` });
  else if (kind === 'wild') background = quarters();
  else if (kind === 'back') {
    background = el('rect', { width: 100, height: 150, style: `fill: ${DARK}` });
    oval = COLORS.red;
  } else return null;
  return svgDoc('0 0 100 150', {}, background,
    el('ellipse', { cx: 50, cy: 75, rx: 39, ry: 43.5, transform: 'rotate(-20 50 75)', style: `fill: ${oval}` }));
}

export const UNO_ASSETS: SvgAsset[] = [
  { name: 'uno-card', params: ['color, wild or back'], samples: [...Object.keys(COLORS), 'wild', 'back'].map(kind => [kind]), render: ([kind]) => cardSvg(kind) },
];
