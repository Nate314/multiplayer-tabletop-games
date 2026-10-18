// The standard 52-card deck, shared by the games that use one (War, Go Fish)

export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export type PlayingCard = { suit: Suit; rank: Rank };

export const SUITS: readonly Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
export const RANKS: readonly Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const FACE_NAMES: Partial<Record<Rank, string>> = { A: 'ace', J: 'jack', Q: 'queen', K: 'king' };

// Suit by suit, ace to king
export function standardDeck(): PlayingCard[] {
  return SUITS.flatMap(suit => RANKS.map(rank => ({ suit, rank })));
}

// 2 to 10 at face value, jack 11, queen 12, king 13, and the ace 14 or 1
export function rankValue(rank: Rank, acesHigh: boolean): number {
  if (rank === 'A') return acesHigh ? 14 : 1;
  return RANKS.indexOf(rank) + 1;
}

export function cardName(card: PlayingCard): string {
  return `${FACE_NAMES[card.rank] ?? card.rank} of ${card.suit}`;
}

export function sameCard(a: PlayingCard, b: PlayingCard): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}
