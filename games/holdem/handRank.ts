// Poker hand ranking: the best five cards of up to seven, as Hold'em plays them
import { rankValue } from '../../shared/playingCards.ts';
import type { PlayingCard } from '../../shared/playingCards.ts';

// category: 0 high card up to 8 straight flush. tiebreak: rank values (2 to 14) to compare in order, for that category.
export type HandRank = { category: number; tiebreak: number[]; name: string };

const SINGULAR: Record<number, string> = {
  2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten',
  11: 'jack', 12: 'queen', 13: 'king', 14: 'ace'
};
const one = (value: number) => SINGULAR[value];
const many = (value: number) => value === 6 ? 'sixes' : `${SINGULAR[value]}s`;

function rankFive(cards: PlayingCard[]): HandRank {
  const values = cards.map(card => rankValue(card.rank, true)).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  // The ranks by how many of each, then by rank: [trips, pair] for a full house, [pair, kickers...] for a pair
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const ranks = groups.map(([value]) => value);
  const shape = groups.map(([, count]) => count).join('');
  const flush = cards.every(card => card.suit === cards[0].suit);
  const wheel = shape === '11111' && values[0] === 14 && values[1] === 5; // A-2-3-4-5, five high
  const straightHigh = wheel ? 5 : shape === '11111' && values[0] - values[4] === 4 ? values[0] : null;

  if (straightHigh !== null && flush) {
    return { category: 8, tiebreak: [straightHigh], name: straightHigh === 14 ? 'Royal flush' : `Straight flush, ${one(straightHigh)} high` };
  }
  if (shape === '41') return { category: 7, tiebreak: ranks, name: `Four of a kind, ${many(ranks[0])}` };
  if (shape === '32') return { category: 6, tiebreak: ranks, name: `Full house, ${many(ranks[0])} over ${many(ranks[1])}` };
  if (flush) return { category: 5, tiebreak: values, name: `Flush, ${one(values[0])} high` };
  if (straightHigh !== null) return { category: 4, tiebreak: [straightHigh], name: `Straight, ${one(straightHigh)} high` };
  if (shape === '311') return { category: 3, tiebreak: ranks, name: `Three of a kind, ${many(ranks[0])}` };
  if (shape === '221') return { category: 2, tiebreak: ranks, name: `Two pair, ${many(ranks[0])} and ${many(ranks[1])}` };
  if (shape === '2111') return { category: 1, tiebreak: ranks, name: `Pair of ${many(ranks[0])}` };
  return { category: 0, tiebreak: values, name: `High card, ${one(values[0])}` };
}

// Above zero when `a` beats `b`, zero for a tie
export function compareHands(a: HandRank, b: HandRank): number {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < a.tiebreak.length; i++) {
    if (a.tiebreak[i] !== b.tiebreak[i]) return a.tiebreak[i] - b.tiebreak[i];
  }
  return 0;
}

// Every five of the cards (21 ways from seven), keeping the best
export function bestHand(cards: PlayingCard[]): HandRank {
  let best: HandRank | null = null;
  const pick = (start: number, chosen: PlayingCard[]) => {
    if (chosen.length === 5) {
      const hand = rankFive(chosen);
      if (!best || compareHands(hand, best) > 0) best = hand;
      return;
    }
    for (let i = start; i < cards.length; i++) pick(i + 1, [...chosen, cards[i]]);
  };
  pick(0, []);
  if (!best) throw new Error('A poker hand needs at least five cards');
  return best;
}
