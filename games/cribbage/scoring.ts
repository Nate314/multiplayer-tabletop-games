// Cribbage scoring for the show and for pegging; pure, used by the rules and the client
import { RANKS, sameCard } from '../../shared/playingCards.ts';
import type { Card, Rank, ScoreItem } from './types.ts';

const rankIndex = (card: Card) => RANKS.indexOf(card.rank);

export function cardValue(rank: Rank): number {
  return Math.min(RANKS.indexOf(rank) + 1, 10);
}

export function totalOf(items: ScoreItem[]): number {
  return items.reduce((sum, item) => sum + item.points, 0);
}

function subsets<T>(items: T[]): T[][] {
  return items.reduce<T[][]>((all, x) => [...all, ...all.map(s => [...s, x])], [[]]);
}

const sum = (cards: Card[]) => cards.reduce((n, c) => n + cardValue(c.rank), 0);

// Distinct consecutive ranks, ace low
function isRun(cards: Card[]): boolean {
  const ranks = cards.map(rankIndex).sort((a, b) => a - b);
  return ranks.every((r, i) => i === 0 || r === ranks[i - 1] + 1);
}

export function scoreShow(hand: Card[], starter: Card, crib: boolean): ScoreItem[] {
  const all = [...hand, starter];
  const subs = subsets(all);
  const items: ScoreItem[] = [];
  for (const cards of subs) if (cards.length > 1 && sum(cards) === 15) items.push({ kind: 'fifteen', cards, points: 2 });
  for (const cards of subs) if (cards.length === 2 && cards[0].rank === cards[1].rank) items.push({ kind: 'pair', cards, points: 2 });
  // Longest runs only; each duplicate rank gives its own run (double run, triple run, double double run)
  const runs = subs.filter(cards => cards.length >= 3 && isRun(cards));
  const longest = Math.max(0, ...runs.map(r => r.length));
  for (const cards of runs) if (cards.length === longest) items.push({ kind: 'run', cards, points: longest });
  const flushHand = hand.every(c => c.suit === hand[0].suit);
  if (flushHand && starter.suit === hand[0].suit) items.push({ kind: 'flush', cards: all, points: 5 });
  else if (flushHand && !crib) items.push({ kind: 'flush', cards: hand, points: 4 });
  const nobs = hand.find(c => c.rank === 'J' && c.suit === starter.suit);
  if (nobs) items.push({ kind: 'nobs', cards: [nobs], points: 1 });
  return items;
}

// Points for the card just played; `pile` holds the cards since the last reset, `count` their total
export function pegItems(pile: Card[], count: number): ScoreItem[] {
  const items: ScoreItem[] = [];
  if (count === 15) items.push({ kind: 'fifteen', cards: pile, points: 2 });
  if (count === 31) items.push({ kind: 'thirtyOne', cards: pile, points: 2 });
  const last = pile[pile.length - 1];
  let same = 0;
  while (same < pile.length && pile[pile.length - 1 - same].rank === last?.rank) same++;
  if (same >= 2) items.push({ kind: 'pair', cards: pile.slice(-same), points: [0, 0, 2, 6, 12][same] });
  for (let size = pile.length; size >= 3; size--) {
    const cards = pile.slice(-size);
    if (isRun(cards)) {
      items.push({ kind: 'run', cards, points: size });
      break;
    }
  }
  return items;
}

export function playable(hand: Card[], count: number): Card[] {
  return hand.filter(card => count + cardValue(card.rank) <= 31);
}

// The highest-scoring unclaimed item whose cards are exactly the selection (4 5 6 is the run before the fifteen)
export function matchCombination(items: ScoreItem[], selection: Card[], taken: number[]): number | null {
  let best: number | null = null;
  items.forEach((item, i) => {
    const matches = !taken.includes(i) && item.cards.length === selection.length && item.cards.every(c => selection.some(s => sameCard(s, c)));
    if (matches && (best === null || item.points > items[best].points)) best = i;
  });
  return best;
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three',
  'twenty-four', 'twenty-five', 'twenty-six', 'twenty-seven', 'twenty-eight', 'twenty-nine', 'thirty', 'thirty-one'];
const word = (n: number) => WORDS[n] ?? String(n);

const PAIRS = ['', '', 'a pair', 'a pair royal', 'a double pair royal'];

// "fifteen two, fifteen four, and a pair"; fifteens read as the running total
export function itemsList(items: ScoreItem[]): string {
  let running = 0;
  const parts = items.map(({ kind, cards, points }) => {
    running += points;
    switch (kind) {
      case 'fifteen': return `fifteen ${word(running)}`;
      case 'pair': return PAIRS[cards.length] || 'a pair';
      case 'run': return `a run of ${word(cards.length)}`;
      case 'flush': return `a flush of ${word(cards.length)}`;
      case 'nobs': return 'his nobs';
      case 'heels': return 'his heels';
      case 'thirtyOne': return 'thirty-one';
      case 'go': return 'a go';
      case 'lastCard': return 'last card';
      case 'claim': return `a claim of ${word(points)}`;
      case 'muggins': return 'muggins';
    }
  });
  return parts.length < 3 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

// "Fifteen two, fifteen four, and a pair is six"
export function describeItems(items: ScoreItem[]): string {
  if (!items.length) return 'No points';
  const list = itemsList(items);
  return `${list[0].toUpperCase()}${list.slice(1)} is ${word(totalOf(items))}`;
}

// A hand in rank order, ace low, so runs and pairs sit together
export const sortedHand = (hand: Card[]): Card[] => [...hand].sort((a, b) => rankIndex(a) - rankIndex(b));
