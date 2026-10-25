import { el, svgDoc, type SvgAsset } from './svg.ts';

// The face or back of a game's own cards and tiles (Phase 10, Skip-Bo, Rack-O, The Crew, Rook, Ticket to Ride,
// Splendor, Rummikub, Scrabble, Monopoly's houses and hotels): a plain fill, diagonal stripes, or diagonal bands from
// --art-fill to --art-fill-4 (through --art-fill-2 and --art-fill-3 when set, else evenly between the two). It
// stretches to its box, and each game colors it on the page element with those variables and --art-stripe, so one
// drawing serves every color, card and theme. The card's own text stays on the page

const FILL = 'var(--art-fill, #9e9e9e)';
const LAST = `var(--art-fill-4, ${FILL})`;
const FILLS = [
  FILL,
  `var(--art-fill-2, color-mix(in srgb, ${FILL} 67%, ${LAST}))`,
  `var(--art-fill-3, color-mix(in srgb, ${FILL} 33%, ${LAST}))`,
  LAST,
];

const solid = () => el('rect', { width: 100, height: 140, style: `fill: ${FILL}` });

function stripes(): string {
  const lines = Array.from({ length: 15 }, (_, i) => {
    const x = -140 + i * 17;
    return el('line', { x1: x, y1: 140, x2: x + 140, y2: 0, 'stroke-width': 8.5, style: 'stroke: var(--art-stripe, rgba(0, 0, 0, 0.2))' });
  });
  return solid() + lines.join('');
}

// Eight steps from the top left to the bottom right, each a mix of the two stops around it
function bands(): string {
  const steps = 8;
  const rects = Array.from({ length: steps }, (_, i) => {
    const at = (i / (steps - 1)) * 3;
    const stop = Math.min(Math.floor(at), 2);
    const share = Math.round((at - stop) * 100);
    const fill = `color-mix(in srgb, ${FILLS[stop]} ${100 - share}%, ${FILLS[stop + 1]})`;
    return el('rect', { x: -70 + i * 30, y: -80, width: 31, height: 300, style: `fill: ${fill}` });
  });
  return el('g', { transform: 'rotate(-35 50 70)' }, ...rects);
}

const PATTERNS: Record<string, () => string> = { solid, stripes, bands };

export function cardArtSvg(pattern: string): string | null {
  if (!Object.hasOwn(PATTERNS, pattern)) return null;
  return svgDoc('0 0 100 140', { preserveAspectRatio: 'none' }, PATTERNS[pattern]());
}

export const CARD_ART_ASSETS: SvgAsset[] = [
  { name: 'card-art', params: ['pattern'], samples: Object.keys(PATTERNS).map(pattern => [pattern]), render: ([pattern]) => cardArtSvg(pattern) },
];
