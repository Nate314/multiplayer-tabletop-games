import { svgUrl } from '../assets/svgCache.ts';
import { RANKS, SUITS, isJoker, type DeckCard } from '../../shared/playingCards.ts';

// The server drawings of the shared dice and playing cards (shared/svg/dice.ts and playingCards.ts)
export const dieUrl = (value: number) => svgUrl('die', value);

export const cardUrl = (card: DeckCard | null) => {
  if (!card) return svgUrl('playing-card-back');
  return isJoker(card) ? svgUrl('playing-card-joker') : svgUrl('playing-card', card.rank, card.suit);
};

// The round piece of shared/svg/disc.ts, colored by the game's --disc-* variables
export const DISC_URL = svgUrl('disc');

// A game's own card or tile face (shared/svg/cardArt.ts), colored by its --art-* variables
export const cardArtUrl = (pattern: 'solid' | 'stripes' | 'bands') => svgUrl('card-art', pattern);

// For usePreloadSvgs on a screen that shows dice or cards
export const DICE_PIECES = [1, 2, 3, 4, 5, 6].map(dieUrl);
export const DECK_PIECES = [
  ...SUITS.flatMap(suit => RANKS.map(rank => cardUrl({ rank, suit }))),
  cardUrl({ joker: 1 }),
  cardUrl(null),
];
