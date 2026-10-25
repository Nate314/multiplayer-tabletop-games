// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';
import type { PlayingCard } from '../../shared/playingCards.ts';
import type { Play as TrickPlay } from '../../shared/tricks.ts';

export type { Result, Seat } from '../../shared/types.ts';
export type { PlayingCard } from '../../shared/playingCards.ts';
import type { Seat } from '../../shared/types.ts';

export type Phase = 'passing' | 'play' | 'handOver';
export type PassDirection = 'left' | 'right' | 'across' | 'none';

export type Move = { type: 'play'; card: PlayingCard };

// Not turn-bound and not undoable. A pass names three cards by their place in the sender's sorted hand.
export type Action =
  | { type: 'pass'; cards: [number, number, number] }
  | { type: 'acknowledgeRound' };

export type Play = TrickPlay<PlayingCard>;

export type LastMove = { type: 'play'; playerNumber: Seat; card: PlayingCard; trickWinner: Seat | null };

// How one hand went
export type HandSummary = {
  handNumber: number;
  taken: Record<Seat, number>; // points each player took in tricks
  change: Record<Seat, number>; // what each score moved by
  moon: Seat | null; // the player who took all 26
  jack: Seat | null; // the player who took the jack of diamonds under the house rule
  acknowledged: Seat[]; // the next hand waits for every connected player
};

// The full state, which never leaves the server
export type GameState = BaseGameState & {
  handNumber: number; // 1 for the first hand
  phase: Phase;
  scores: Record<Seat, number>;
  hands: Record<Seat, PlayingCard[]>; // each kept sorted, so a pass's indexes match what its sender sees
  passes: Record<Seat, PlayingCard[]>; // cards sent but not yet received, keyed by the sender
  trick: Play[];
  lastTrick: { plays: Play[]; winner: Seat } | null;
  tricksPlayed: number; // tricks finished this hand
  heartsBroken: boolean;
  taken: Record<Seat, number>; // points taken this hand
  jackTaker: Seat | null; // who has taken the jack of diamonds this hand, when it is worth minus 10
  roundSummary: HandSummary | null;
  lastMove: LastMove | null;
};

// The game state as the server sends it to one browser: only that player's own hand and pass
export type PublicGameState =
  Omit<GameState, 'hands' | 'passes'> &
  BasePublicState & {
    hand: PlayingCard[]; // the viewer's own hand; empty for the table view
    handCounts: Record<Seat, number>;
    passed: Seat[]; // who has sent their pass this hand
    myPass: PlayingCard[]; // the cards the viewer sent, until the pass completes
  };
