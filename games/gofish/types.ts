// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';
import type { PlayingCard, Rank } from '../../shared/playingCards.ts';

export type { Result, Seat } from '../../shared/types.ts';
export type { PlayingCard, Rank } from '../../shared/playingCards.ts';

export type Move = { type: 'ask'; target: Seat; rank: Rank };

// What happened after a miss: no fishing after a hit, the asked rank was drawn, another card was drawn,
// or the stock was empty so nothing could be drawn
export type Fished = 'none' | 'asked' | 'other' | 'empty';

// One ask and its answer, which everyone at the table hears. The card drawn is shown only when it was the asked rank.
export type Ask = {
  asker: Seat;
  target: Seat;
  rank: Rank;
  given: number; // how many cards the target handed over; 0 is "go fish"
  fished: Fished;
  books: Rank[]; // books the asker laid down with this ask
  goesAgain: boolean;
};

// The full state, which never leaves the server: nobody may see another hand or the stock
export type GameState = BaseGameState & {
  hands: Record<Seat, PlayingCard[]>;
  stock: PlayingCard[]; // the top card is the last one
  books: Record<Seat, Rank[]>; // kept for a dismissed player too, so all 13 books still end the game
  log: Ask[]; // every ask in order
  lastMove: Ask | null;
  fishedCard: PlayingCard | null; // the card the last ask drew, if it drew one
};

// The game state as the server sends it to one browser: only that player's own hand
export type PublicGameState = Omit<GameState, 'hands' | 'stock' | 'fishedCard'> & BasePublicState & {
  hand: PlayingCard[]; // the viewer's own hand; empty for the table view
  handCounts: Record<Seat, number>;
  stockCount: number;
  // The card the last ask drew: shown to the asker, and to everyone when it was the asked rank
  fishedCard: PlayingCard | null;
};
