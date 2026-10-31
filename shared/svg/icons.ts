import { el, svgDoc, type SvgAsset } from './svg.ts';

// A 24 by 24 outline drawing in currentColor, so it follows the text color of the button or page it sits on
export function lineIcon(...children: string[]): string {
  return svgDoc('0 0 24 24', { fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    ...children);
}

// A filled shape inside a line icon, such as a pip or a heart
export const solid = (tag: string, attrs: Record<string, string | number>) => el(tag, { ...attrs, fill: 'currentColor', stroke: 'none' });

function gearPath(teeth: number, outer: number, inner: number): string {
  const step = (Math.PI * 2) / teeth;
  const point = (angle: number, radius: number) => `${(12 + radius * Math.cos(angle)).toFixed(2)} ${(12 + radius * Math.sin(angle)).toFixed(2)}`;
  const corners = Array.from({ length: teeth }, (_, i) => {
    const a = i * step;
    return [point(a - step * 0.32, inner), point(a - step * 0.18, outer), point(a + step * 0.18, outer), point(a + step * 0.32, inner)];
  }).flat();
  return `M${corners.join('L')}Z`;
}

export const rocketIcon = () => lineIcon(
  el('path', { d: 'M12 2c3 2.5 4.5 6 4.5 10v5h-9v-5c0-4 1.5-7.5 4.5-10z' }),
  el('circle', { cx: 12, cy: 10, r: 1.5 }),
  el('path', { d: 'M7.5 13l-3 3v3h3M16.5 13l3 3v3h-3M10 20l2 2 2-2' }));

const EYE_OUTLINE = 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z';

// The header icons
const ICONS: Record<string, () => string> = {
  share: () => lineIcon(
    el('circle', { cx: 18, cy: 5, r: 3 }),
    el('circle', { cx: 6, cy: 12, r: 3 }),
    el('circle', { cx: 18, cy: 19, r: 3 }),
    el('path', { d: 'M8.6 13.5l6.8 4M15.4 6.5l-6.8 4' })),
  github: () => svgDoc('0 0 16 16', { fill: 'currentColor' },
    el('path', { d: 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z' })),
  gear: () => lineIcon(el('path', { d: gearPath(8, 10, 7.5) }), el('circle', { cx: 12, cy: 12, r: 3 })),
  sun: () => lineIcon(
    el('circle', { cx: 12, cy: 12, r: 4 }),
    el('path', { d: 'M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' })),
  moon: () => lineIcon(el('path', { d: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z' })),
  rocket: rocketIcon,
  eye: () => lineIcon(el('path', { d: EYE_OUTLINE }), el('circle', { cx: 12, cy: 12, r: 3 })),
  'eye-off': () => lineIcon(el('path', { d: EYE_OUTLINE }), el('circle', { cx: 12, cy: 12, r: 3 }), el('path', { d: 'M3 3l18 18' })),
};

export function iconSvg(name: string): string | null {
  return Object.hasOwn(ICONS, name) ? ICONS[name]() : null;
}

export const ICON_ASSETS: SvgAsset[] = [
  { name: 'icon', params: ['icon'], samples: Object.keys(ICONS).map(name => [name]), render: ([name]) => iconSvg(name) },
];
