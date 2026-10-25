import { el, type SvgAsset } from '../../shared/svg/svg.ts';
import { lineIcon, solid } from '../../shared/svg/icons.ts';

// The picture on each corner, railroad, utility, tax and card space, in currentColor
const SPACE_ICONS: Record<string, () => string> = {
  railroad: () => lineIcon(el('rect', { x: 5, y: 3, width: 14, height: 14, rx: 3 }), el('rect', { x: 7.5, y: 6, width: 9, height: 4.5, rx: 1 }),
    solid('circle', { cx: 9, cy: 14, r: 1.1 }), solid('circle', { cx: 15, cy: 14, r: 1.1 }), el('path', { d: 'M8 17l-2 4M16 17l2 4' })),
  chance: () => lineIcon(el('path', { d: 'M8.5 8a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.3-1.5 2.3V15' }), solid('circle', { cx: 12, cy: 19, r: 1.3 })),
  chest: () => lineIcon(el('path', { d: 'M3 10a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v9H3zM3 12h18M10.5 11h3v3h-3z' })),
  tax: () => lineIcon(el('path', { d: 'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' })),
  go: () => lineIcon(el('path', { d: 'M20 12H4M10 6l-6 6 6 6' })),
  parking: () => lineIcon(el('rect', { x: 3, y: 3, width: 18, height: 18, rx: 3 }), el('path', { d: 'M9 17V7h4a3 3 0 0 1 0 6H9' })),
  goToJail: () => lineIcon(el('path', { d: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z' }), el('path', { d: 'M12 7.5l1.2 2.5 2.8.4-2 2 .5 2.8-2.5-1.4-2.5 1.4.5-2.8-2-2 2.8-.4z' })),
  jail: () => lineIcon(el('rect', { x: 4, y: 11, width: 16, height: 10, rx: 2 }), el('path', { d: 'M8 11V7a4 4 0 0 1 8 0v4' })),
  water: () => lineIcon(el('path', { d: 'M3 8h9a3 3 0 0 1 3 3v1M7 5v3M4 5h6M15 12v1' }), el('path', { d: 'M15 16c-1 1.5-1.5 2.5-1.5 3.2a1.5 1.5 0 0 0 3 0c0-.7-.5-1.7-1.5-3.2z' })),
  electric: () => lineIcon(el('path', { d: 'M9 18h6M10 21h4M8.5 14.5A6 6 0 1 1 15.5 14.5c-.8.7-1.5 1.7-1.5 3.5h-4c0-1.8-.7-2.8-1.5-3.5z' })),
};

export const MONOPOLY_ASSETS: SvgAsset[] = [{
  name: 'monopoly-space',
  params: ['kind'],
  samples: Object.keys(SPACE_ICONS).map(kind => [kind]),
  render: ([kind]) => (Object.hasOwn(SPACE_ICONS, kind) ? SPACE_ICONS[kind]() : null),
}];
