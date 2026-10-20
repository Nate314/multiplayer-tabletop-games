// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Result, Seat } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

export type Color = 'red' | 'yellow' | 'green' | 'black';

// A numbered card, 5 to 14, or the Rook Bird card, which has no color or number of its own
export type NumberCard = { color: Color; number: number };
export type RookCard = { color: 'rook' };
export type Card = NumberCard | RookCard;

// The partnerships: team 0 is seats 1 and 3, team 1 is seats 2 and 4
export type { Team } from '../../shared/partnerships.ts';
export type TeamScores = [number, number];

export type Phase = 'bidding' | 'discard' | 'trump' | 'play' | 'handOver';

export type Move =
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'discard'; cards: Card[] } // the bid winner lays aside as many cards as the nest held
  | { type: 'nameTrump'; color: Color }
  | { type: 'play'; card: Card };

// Not turn-bound and not undoable
export type Action = { type: 'acknowledgeRound' };

export type Play = { seat: Seat; card: Card };

// `won` is the bid that took the bidding when this pass ended it; `redeal` is set when all four passed
export type LastMove =
  | { type: 'bid'; playerNumber: Seat; amount: number; won: boolean }
  | { type: 'pass'; playerNumber: Seat; won: { seat: Seat; amount: number } | null; redeal: boolean }
  | { type: 'discard'; playerNumber: Seat }
  | { type: 'nameTrump'; playerNumber: Seat; color: Color }
  | { type: 'play'; playerNumber: Seat; card: Card; trickWinner: Seat | null };

export type Bidding = {
  high: { seat: Seat; amount: number } | null;
  passed: Seat[];
};

// How one hand went
export type HandSummary = {
  handNumber: number;
  bidder: Seat;
  bid: number;
  made: boolean;
  points: TeamScores; // counters each team captured, the nest included
  change: TeamScores; // what each team's score moved by
  nestPoints: number; // counters in the nest, which went with the last trick
  lastTrick: Seat; // who took the last trick, and with it the nest
  acknowledged: Seat[]; // the next hand waits for every connected player
};

// The full state, which never leaves the server
export type GameState = BaseGameState & {
  handNumber: number; // 1 for the first hand
  dealer: Seat | null;
  scores: TeamScores;
  phase: Phase;
  hands: Record<Seat, Card[]>;
  nest: Card[]; // face down; after the discard, the cards the bidder laid aside
  bidding: Bidding;
  bidder: Seat | null;
  bid: number | null;
  trump: Color | null;
  trick: Play[]; // the trick being played, in play order
  lastTrick: { plays: Play[]; winner: Seat } | null;
  tricksWon: TeamScores;
  captured: TeamScores; // counters taken in tricks this hand, hidden until it is scored
  roundSummary: HandSummary | null;
  lastMove: LastMove | null;
};

// The game state as the server sends it to one browser: only that player's own hand, and the laid-aside cards to the bidder
export type PublicGameState =
  Omit<GameState, 'hands' | 'nest' | 'captured'> &
  BasePublicState & {
    hand: Card[]; // the viewer's own hand; empty for the table view
    handCounts: Record<Seat, number>;
    nestCount: number;
    discards: Card[]; // what the bidder laid aside, in the bidder's own view only
  };
