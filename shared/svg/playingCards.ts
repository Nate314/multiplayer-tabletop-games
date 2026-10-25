import { el, escapeText, svgDoc, type SvgAsset } from './svg.ts';
import { RANKS, SUITS, type Rank, type Suit } from '../playingCards.ts';

// The standard playing card's face marks, joker and back, in a 64 by 90 box (the card's own proportions). The face
// color, border and the selected and highlighted outlines stay on the page element (.playing-card in src/App.scss);
// the marks paint with the --playing-card-* variables a game may set, with today's defaults behind them

const SUIT_SYMBOLS: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' };
const RED = 'fill: var(--playing-card-red, var(--playing-card-red-default, #c0262d))';
const BLACK = 'fill: var(--playing-card-black, var(--playing-card-black-default, #1d1d1b))';
const VIEW = '0 0 64 90';
const FONT = { 'font-weight': 700 };

function corners(text: string, style: string): string {
  const corner = (transform?: string) => el('text', { x: 5, y: 15, 'font-size': 11.3, style, transform, ...FONT }, escapeText(text));
  return corner() + corner('rotate(180 32 45)');
}

export function cardSvg(rank: string, suit: string): string | null {
  if (!RANKS.includes(rank as Rank) || !SUITS.includes(suit as Suit)) return null;
  const symbol = SUIT_SYMBOLS[suit as Suit];
  const style = suit === 'hearts' || suit === 'diamonds' ? RED : BLACK;
  return svgDoc(VIEW, {},
    corners(`${rank}${symbol}`, style),
    el('text', { x: 32, y: 54, 'font-size': 27, 'text-anchor': 'middle', style, ...FONT }, symbol));
}

// JOKER reads down the middle, a letter under the other, with a star in two corners
export function jokerSvg(): string {
  return svgDoc(VIEW, {},
    corners('★', RED),
    ...[...'JOKER'].map((letter, i) => el('text', { x: 32, y: 26 + i * 10, 'font-size': 10.5, 'text-anchor': 'middle', style: RED, ...FONT }, letter)));
}

// Diagonal stripes over the back color; the card's rounded corners clip them (overflow on .playing-card)
export function backSvg(): string {
  const stripe = 'stroke: var(--playing-card-stripe, var(--playing-card-stripe-default, rgba(255, 255, 255, 0.18)))';
  const stripes = Array.from({ length: 28 }, (_, i) => {
    const x = -90 + i * 5.66;
    return el('line', { x1: x, y1: 90, x2: x + 90, y2: 0, 'stroke-width': 2.83, style: stripe });
  });
  return svgDoc(VIEW, { preserveAspectRatio: 'none' },
    el('rect', { width: 64, height: 90, style: 'fill: var(--playing-card-back, var(--playing-card-back-default, #2b4c7e))' }),
    ...stripes);
}

export const PLAYING_CARD_ASSETS: SvgAsset[] = [
  {
    name: 'playing-card',
    params: ['rank', 'suit'],
    samples: [['A', 'spades'], ['10', 'hearts'], ['Q', 'diamonds'], ['7', 'clubs']],
    render: ([rank, suit]) => cardSvg(rank, suit),
  },
  { name: 'playing-card-joker', params: [], samples: [], render: jokerSvg },
  { name: 'playing-card-back', params: [], samples: [], render: backSvg },
];
