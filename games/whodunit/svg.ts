// An original line drawing for each of the twenty-one cards, in currentColor; the game's SCSS colors each kind
import { el, type SvgAsset } from '../../shared/svg/svg.ts';
import { lineIcon, solid } from '../../shared/svg/icons.ts';
import { CARDS } from './content.ts';
import type { CardId } from './content.ts';

const path = (d: string) => el('path', { d });
const dot = (cx: number, cy: number, r = 1) => solid('circle', { cx, cy, r });
// Head and shoulders, which every suspect wears their own accessory over
const bust = () => [el('circle', { cx: 12, cy: 10, r: 4 }), path('M4 22c0-4.5 3.5-7 8-7s8 2.5 8 7')];

const ART: Record<CardId, () => string> = {
  // A peaked captain's cap with a badge
  'commodore-brine': () => lineIcon(...bust(), path('M6.5 7.5C8 4 16 4 17.5 7.5zM6 7.5h12'), dot(12, 5.6, 0.8)),
  // A branch of coral pinned in the hair
  'madame-coral': () => lineIcon(...bust(), path('M15 7l3-4M17 5l2 .5M16.2 6l-1-3')),
  // Round spectacles and a head mirror
  'doctor-tidewell': () => lineIcon(...bust(), el('circle', { cx: 10.3, cy: 10, r: 1.3 }), el('circle', { cx: 13.7, cy: 10, r: 1.3 }), path('M11.6 10h.8M12 6V3.5'), el('circle', { cx: 12, cy: 2.5, r: 1 })),
  // A gull in flight above
  'miss-gull': () => lineIcon(...bust(), path('M7 3.5c1.5-1 3-1 5 1 2-2 3.5-2 5-1')),
  // A square scholar's cap with a tassel
  'professor-kelp': () => lineIcon(...bust(), path('M5 6l7-3 7 3-7 3zM18 6.5v3.5')),
  // A string of pearls and a small tiara
  'baroness-pearl': () => lineIcon(...bust(), path('M9 6l1.5-2 1.5 1.5 1.5-1.5L15 6'), ...[8, 10, 12, 14, 16].map((x, i) => dot(x, 16.5 + (i === 2 ? 1 : i % 2 ? 0.6 : 0), 0.9))),
  // A long shaft with a barbed head
  harpoon: () => lineIcon(path('M3 21L17 7M17 7l4-4M21 3l-1 5M21 3l-5 1M14.5 9.5l-1.5-3M14.5 9.5l3 1.5')),
  // Three links of chain and a small anchor
  'anchor-chain': () => lineIcon(el('ellipse', { cx: 6, cy: 6, rx: 3, ry: 1.8, transform: 'rotate(45 6 6)' }), el('ellipse', { cx: 10, cy: 10, rx: 1.8, ry: 3, transform: 'rotate(45 10 10)' }),
    el('circle', { cx: 15.5, cy: 12.5, r: 1.2 }), path('M15.5 13.7V21M12.5 16h6M11.5 19a4 4 0 0 0 8 0')),
  // An oar: a grip, a shaft and a broad blade
  'boat-oar': () => lineIcon(path('M4 20l2-2M6 18l8-8M14 10c1-3 4-6 6-6s0 4-3 6-3 1-3 0z')),
  // A telescope in three drawn sections on a short stand
  'brass-telescope': () => lineIcon(path('M3 13l2 3 4-2-2-3zM9 10l1.5 3L16 10l-1.5-3zM16 7l1 2 4-2-1-2zM11 13l-2 8M11 13l3 8')),
  // A tapered spike with a ring at its head
  marlinspike: () => lineIcon(el('circle', { cx: 6, cy: 5, r: 2 }), path('M7.5 6.5l1 1-1 1L20 21 8.5 7.5')),
  // A wooden mallet: a barrel head on a handle
  'deck-mallet': () => lineIcon(el('rect', { x: 3, y: 4, width: 12, height: 6, rx: 2, transform: 'rotate(-20 9 7)' }), path('M10 9l5 12')),
  // A boat shed over the water
  boathouse: () => lineIcon(path('M3 11l9-7 9 7M5 9.5V16h14V9.5M9 16v-4h6v4M2 20c2-1.5 3-1.5 5 0s3 1.5 5 0 3-1.5 5 0 3 1.5 5 0')),
  // Double doors under a hanging lamp
  'grand-foyer': () => lineIcon(path('M5 21V10h14v11M12 10v11M3 21h18M10 15.5h1M13 15.5h1M12 2v3M9 5h6l-1 2h-4z')),
  // The sun over a railing
  'sun-terrace': () => lineIcon(el('circle', { cx: 12, cy: 8, r: 3 }), path('M12 2v1.5M6 8H4.5M19.5 8H18M7.8 3.8l1 1M16.2 3.8l-1 1M3 15h18M3 21h18M6 15v6M10 15v6M14 15v6M18 15v6')),
  // A tub with rising steam
  'salt-spa': () => lineIcon(path('M3 13h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5zM7 20l-1 2M17 20l1 2M8 10c-1-1.5 1-2.5 0-4M12 10c-1-1.5 1-2.5 0-4M16 10c-1-1.5 1-2.5 0-4')),
  // A rolled-out chart with a compass star
  'chart-room': () => lineIcon(path('M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16'), path('M12 9l1 3-1 3-1-3z')),
  // A signal flag on a mast and a lamp
  'signal-room': () => lineIcon(path('M5 22V3M5 4h11l-3 4 3 4H5'), el('rect', { x: 14, y: 15, width: 6, height: 6, rx: 1 }), path('M17 15v-2M15 18h4')),
  // A pot with a lid on the stove
  galley: () => lineIcon(path('M4 11h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM2 11h20M9 8h6M12 8V6M8 4c0-1 1-1 1-2M15 4c0-1 1-1 1-2')),
  // Two playing cards fanned on a table
  'card-parlor': () => lineIcon(el('rect', { x: 4, y: 5, width: 9, height: 13, rx: 1.5, transform: 'rotate(-12 8.5 11.5)' }),
    el('rect', { x: 11, y: 4, width: 9, height: 13, rx: 1.5, transform: 'rotate(10 15.5 10.5)' }), path('M15.5 8.5l1.5 2-1.5 2-1.5-2z'), path('M3 21h18')),
  // A bottle and a glass under a cellar arch
  'wine-cellar': () => lineIcon(path('M3 21V10a9 7 0 0 1 18 0v11M8 21v-6l1-2v-3h2v3l1 2v6zM14.5 14h4l-.5 3a1.5 1.5 0 0 1-3 0zM16.5 18.5V21M15 21h3')),
};

export const WHODUNIT_ASSETS: SvgAsset[] = [{
  name: 'whodunit-card',
  params: ['card'],
  samples: CARDS.map(card => [card]),
  render: ([card]) => (Object.hasOwn(ART, card) ? ART[card as CardId]() : null),
}];
