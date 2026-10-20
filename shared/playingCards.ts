// The standard 52-card deck, shared by the games that use one (War, Go Fish)

export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export type PlayingCard = { suit: Suit; rank: Rank };
export type JokerCard = { joker: number }; // 1-based index
// A suited card or a joker; games without jokers only ever see PlayingCard
export type DeckCard = PlayingCard | JokerCard;
export type DeckOptions = { ranks?: readonly Rank[]; suits?: readonly Suit[] };

export const SUITS: readonly Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
export const RANKS: readonly Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const FACE_NAMES: Partial<Record<Rank, string>> = { A: 'ace', J: 'jack', Q: 'queen', K: 'king' };

// Suit by suit, ace to king, keeping only the given ranks and suits; jokers come after the suits
export function standardDeck(options?: DeckOptions): PlayingCard[];
export function standardDeck(options: DeckOptions & { jokers: number }): DeckCard[];
export function standardDeck({ ranks = RANKS, suits = SUITS, jokers = 0 }: DeckOptions & { jokers?: number } = {}): DeckCard[] {
  const suited = SUITS.filter(suit => suits.includes(suit)).flatMap(suit => RANKS.filter(rank => ranks.includes(rank)).map(rank => ({ suit, rank })));
  return [...suited, ...Array.from({ length: jokers }, (_, i) => ({ joker: i + 1 }))];
}

export function isJoker(card: DeckCard): card is JokerCard {
  return 'joker' in card;
}

// 2 to 10 at face value, jack 11, queen 12, king 13, and the ace 14 or 1
export function rankValue(rank: Rank, acesHigh: boolean): number {
  if (rank === 'A') return acesHigh ? 14 : 1;
  return RANKS.indexOf(rank) + 1;
}

export function cardName(card: DeckCard): string {
  if (isJoker(card)) return 'joker';
  return `${FACE_NAMES[card.rank] ?? card.rank} of ${card.suit}`;
}

export function sameCard(a: DeckCard, b: DeckCard): boolean {
  if (isJoker(a) || isJoker(b)) return isJoker(a) && isJoker(b) && a.joker === b.joker;
  return a.suit === b.suit && a.rank === b.rank;
}
