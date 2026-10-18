// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';
import type { PlayingCard } from '../../shared/playingCards.ts';

export type { Result, Seat } from '../../shared/types.ts';
export type { PlayingCard } from '../../shared/playingCards.ts';

export type Move = { type: 'flip' };

// A card put into the battle. Face-down cards are war cards, which nobody sees.
export type Laid = { card: PlayingCard; faceUp: boolean };

// A battle under way: what each player has put in so far, in order, and who has flipped in the current round.
// A round is the opening flip of each player, or one war (a card face down and one face up each).
export type Battle = {
  cards: Record<Seat, Laid[]>;
  flipped: Seat[];
  wars: number; // how many ties so far; 0 in the opening round
};

// How the last flip turned out: the other player still has to flip, the round tied and starts a war, a player
// won and took every card in the battle, or both players ran out of cards on a tie and took their own cards back
export type Outcome =
  | { kind: 'waiting' }
  | { kind: 'war' }
  | { kind: 'won'; winner: Seat; taken: number }
  | { kind: 'returned' };

// `up` is the card that counts for this player: the one just turned up, or, when `fresh` is false, the last card
// they turned up, which stands again because they had no cards left. `down` is how many cards went face down.
export type LastMove = {
  type: 'flip';
  playerNumber: Seat;
  war: boolean;
  down: number;
  up: PlayingCard;
  fresh: boolean;
  outcome: Outcome;
};

// The full state, which never leaves the server: nobody may see the order of a pile or a face-down card
export type GameState = BaseGameState & {
  piles: Record<Seat, PlayingCard[]>; // the top card is the first one
  battle: Battle | null;
  // The battle that was just settled, kept on the table until the next one starts
  lastBattle: { cards: Record<Seat, Laid[]>; winner: Seat | null; wars: number } | null;
  lastMove: LastMove | null;
};

// A battle card as a browser sees it: null for a face-down card
export type PublicCard = PlayingCard | null;

export type PublicBattle = Omit<Battle, 'cards'> & { cards: Record<Seat, PublicCard[]> };

// The game state as the server sends it: only how many cards each pile holds
export type PublicGameState = Omit<GameState, 'piles' | 'battle' | 'lastBattle'> & BasePublicState & {
  pileCounts: Record<Seat, number>;
  battle: PublicBattle | null;
  lastBattle: { cards: Record<Seat, PublicCard[]>; winner: Seat | null; wars: number } | null;
};
