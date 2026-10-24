// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';
import type { Play as TrickPlay } from '../../shared/tricks.ts';
import type { PlayingCard } from '../../shared/playingCards.ts';

export type { Result, Seat } from '../../shared/types.ts';
export type { PlayingCard as Card, Suit } from '../../shared/playingCards.ts';
import type { Seat } from '../../shared/types.ts';

// The partnerships: team 0 is seats 1 and 3, team 1 is seats 2 and 4
export type { Team } from '../../shared/partnerships.ts';
export type TeamScores = [number, number];

export type Phase = 'bidding' | 'play' | 'handOver';

export type Move =
  | { type: 'bid'; tricks: number } // 0 is nil
  | { type: 'play'; card: PlayingCard };

// Not turn-bound and not undoable
export type Action = { type: 'acknowledgeRound' };

export type Play = TrickPlay<PlayingCard>;

export type LastMove =
  | { type: 'bid'; playerNumber: Seat; tricks: number }
  | { type: 'play'; playerNumber: Seat; card: PlayingCard; trickWinner: Seat | null };

// How one team's hand went
export type TeamResult = {
  contract: number; // the partners' non-nil bids added up
  tricks: number; // both partners' tricks, the nil bidder's included
  made: boolean;
  overtricks: number; // bags taken this hand
  bagPenalty: boolean; // the bags reached 10 this hand and cost 100
  nils: { seat: Seat; made: boolean }[];
  change: number; // what the team's score moved by
};

export type HandSummary = {
  handNumber: number;
  teams: [TeamResult, TeamResult];
  acknowledged: Seat[]; // the next hand waits for every connected player
};

// The full state, which never leaves the server
export type GameState = BaseGameState & {
  handNumber: number; // 1 for the first hand
  dealer: Seat | null;
  scores: TeamScores;
  bags: TeamScores; // overtricks carried toward the next 100-point penalty, 0 to 9
  phase: Phase;
  hands: Record<Seat, PlayingCard[]>;
  bids: Record<Seat, number>; // the bids made so far this hand
  tricksTaken: Record<Seat, number>;
  trick: Play[]; // the trick being played, in play order
  lastTrick: { plays: Play[]; winner: Seat } | null;
  spadesBroken: boolean;
  roundSummary: HandSummary | null;
  lastMove: LastMove | null;
};

// The game state as the server sends it to one browser: only that player's own hand
export type PublicGameState =
  Omit<GameState, 'hands'> &
  BasePublicState & {
    hand: PlayingCard[]; // the viewer's own hand; empty for the table view
    handCounts: Record<Seat, number>;
  };
