// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';
import type { PlayingCard } from '../../shared/playingCards.ts';

export type { Result, Seat } from '../../shared/types.ts';
export type { PlayingCard as Card, Rank, Suit } from '../../shared/playingCards.ts';
export type { Team } from '../../shared/partnerships.ts';

type Card = PlayingCard;

// What scores: the seat at 2 or 3 players, the Team at 4
export type Side = number;
export type Pegs = { front: number; back: number };

// 'discard': everyone lays cards to the crib at once. 'cut': the seat after the dealer cuts the starter.
// 'show': hands and crib are counted in order. 'roundOver': the Continue step.
export type Phase = 'discard' | 'cut' | 'pegging' | 'show' | 'roundOver';

export type ScoreItem = {
  // 'claim': the part of a count its owner claimed under Muggins; 'muggins': points an opponent took by pressing
  kind: 'fifteen' | 'pair' | 'run' | 'flush' | 'nobs' | 'heels' | 'thirtyOne' | 'go' | 'lastCard' | 'claim' | 'muggins';
  cards: Card[];
  points: number;
};

// One count of a hand or the crib. `claimed` is the owner's number when Muggins is on; `closesAt` is when
// the Muggins window ends (ms since epoch), null when there is no window open.
export type Show = {
  owner: Seat;
  crib: boolean;
  cards: Card[];
  items: ScoreItem[];
  total: number;
  claimed: number | null;
  muggins: { by: Seat; points: number }[]; // points is -2 for a Single press when nothing was missed
  passed: Seat[]; // opponents who pressed No Muggins
  taken: number[]; // the indexes of `items` already named by a Name-the-points press
  closesAt: number | null;
};

export type Move =
  | { type: 'discard'; cards: Card[] }
  | { type: 'cut' }
  | { type: 'play'; card: Card }
  | { type: 'go' }
  | { type: 'claim'; points: number };

// Not turn-bound; Muggins and No Muggins are recorded as moves
export type Action =
  | { type: 'muggins'; cards?: Card[] }
  | { type: 'noMuggins' }
  | { type: 'acknowledgeRound' };

// `items` are what the play scored (empty for none), so the text can read "for fifteen two"
export type LastMove =
  | { type: 'discard'; playerNumber: Seat }
  | { type: 'cut'; playerNumber: Seat; starter: Card; heels: boolean }
  | { type: 'play'; playerNumber: Seat; card: Card; items: ScoreItem[] }
  | { type: 'go'; playerNumber: Seat; lastCard: boolean } // lastCard: the Go scored its point
  | { type: 'claim'; playerNumber: Seat; crib: boolean; points: number }
  | { type: 'count'; playerNumber: Seat; crib: boolean; points: number; items: ScoreItem[] }
  | { type: 'muggins'; playerNumber: Seat; points: number } // the points the presser took (negative cost for a wrong Single press)
  | { type: 'noMuggins'; playerNumber: Seat };

// One count as the round summary lists it; `claimed` and `muggins` as on the Show
export type CountSummary = Pick<Show, 'owner' | 'crib' | 'items' | 'total' | 'claimed' | 'muggins'>;

// How one round went
export type RoundSummary = {
  handNumber: number;
  dealer: Seat;
  counts: CountSummary[];
  change: Record<Side, number>; // points each side scored this round
  acknowledged: Seat[]; // the next round waits for every connected player
};

// The full state, which never leaves the server
export type GameState = BaseGameState & {
  handNumber: number; // 1 for the first hand
  dealer: Seat | null;
  phase: Phase;
  hands: Record<Seat, Card[]>;
  crib: Card[];
  deck: Card[];
  starter: Card | null;
  pile: { seat: Seat; card: Card }[]; // the cards played since the count last reset
  count: number;
  played: Record<Seat, Card[]>; // each seat's pegging cards this round, kept for the show
  saidGo: Seat[];
  scores: Record<Side, number>;
  handStartScores: Record<Side, number>; // the scores when the hand was dealt, for the round summary's change
  pegs: Record<Side, Pegs>;
  shows: Show[];
  showIndex: number;
  roundSummary: RoundSummary | null;
  lastMove: LastMove | null;
};

// Until its owner has claimed, and while a Muggins window is open in a style other than 'shown', a show carries no
// items, total or taken
export type PublicShow = Omit<Show, 'items' | 'total' | 'taken'> & Partial<Pick<Show, 'items' | 'total' | 'taken'>>;

// The game state as the server sends it to one browser: only that player's own hand
export type PublicGameState =
  Omit<GameState, 'hands' | 'crib' | 'deck' | 'shows'> &
  BasePublicState & {
    hand: Card[]; // the viewer's own hand; empty for the table view
    handCounts: Record<Seat, number>;
    cribCount: number;
    shows: PublicShow[];
  };
