// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';
import type { PlayingCard, Suit } from '../../shared/playingCards.ts';

export type { Result, Seat } from '../../shared/types.ts';
export type { PlayingCard as Card, Suit } from '../../shared/playingCards.ts';
import type { Seat } from '../../shared/types.ts';

type Card = PlayingCard;

// The partnerships: team 0 is seats 1 and 3, team 1 is seats 2 and 4
export type { Team } from '../../shared/partnerships.ts';
export type TeamScores = [number, number];

// 'order': the first round of making trump, on the turned-up card. 'name': the second round, any other suit.
// 'alone': the maker decides whether to go alone. 'discard': the dealer, having picked up, lays one card away.
export type Phase = 'order' | 'name' | 'alone' | 'discard' | 'play' | 'handOver';

export type Move =
  | { type: 'orderUp' }
  | { type: 'pass' }
  | { type: 'nameTrump'; suit: Suit }
  | { type: 'goAlone'; alone: boolean }
  | { type: 'discard'; card: Card }
  | { type: 'play'; card: Card };

// Not turn-bound and not undoable
export type Action = { type: 'acknowledgeRound' };

export type Play = { seat: Seat; card: Card };

// `turnedDown` is set when this pass ended the first round; `redeal` when it ended the second
export type LastMove =
  | { type: 'orderUp'; playerNumber: Seat; suit: Suit }
  | { type: 'pass'; playerNumber: Seat; turnedDown: boolean; redeal: boolean }
  | { type: 'nameTrump'; playerNumber: Seat; suit: Suit }
  | { type: 'goAlone'; playerNumber: Seat; alone: boolean }
  | { type: 'discard'; playerNumber: Seat }
  | { type: 'play'; playerNumber: Seat; card: Card; trickWinner: Seat | null };

// How one hand went
export type HandSummary = {
  handNumber: number;
  maker: Seat;
  alone: boolean;
  tricks: TeamScores; // tricks each team took
  change: TeamScores; // points each team scored
  acknowledged: Seat[]; // the next hand waits for every connected player
};

// The full state, which never leaves the server
export type GameState = BaseGameState & {
  handNumber: number; // 1 for the first hand
  dealer: Seat | null;
  scores: TeamScores;
  phase: Phase;
  hands: Record<Seat, Card[]>;
  upcard: Card | null; // the card turned up on the kitty, seen by everyone
  kitty: Card[]; // the three face-down cards under it
  discard: Card | null; // the dealer's card laid away after picking up
  passed: Seat[]; // who has passed in this round of making trump
  maker: Seat | null;
  trump: Suit | null;
  alone: boolean;
  trick: Play[]; // the trick being played, in play order
  lastTrick: { plays: Play[]; winner: Seat } | null;
  tricksWon: TeamScores;
  roundSummary: HandSummary | null;
  lastMove: LastMove | null;
};

// The game state as the server sends it to one browser: only that player's own hand, and the discard to the dealer
export type PublicGameState =
  Omit<GameState, 'hands' | 'kitty' | 'discard'> &
  BasePublicState & {
    hand: Card[]; // the viewer's own hand; empty for the table view
    handCounts: Record<Seat, number>;
    discard: Card | null; // the dealer's own view only
  };
