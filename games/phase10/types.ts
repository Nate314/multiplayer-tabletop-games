// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Result, Seat, UndoVote } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

export type CardColor = 'red' | 'blue' | 'green' | 'yellow';

// Every card has an id, unique in the deck, so moves can name the exact cards they use
export type Card =
  | { id: number; kind: 'number'; value: number; color: CardColor }
  | { id: number; kind: 'wild' }
  | { id: number; kind: 'skip' };

export type GroupKind = 'set' | 'run' | 'color';

// One part of a phase, e.g. a set of 3 or a run of 4
export type Requirement = { kind: GroupKind; size: number };

// Cards laid down on the table. A set keeps the number it is made of, a run its lowest number
// (its cards are in order, so a wild stands for start + its index), and a color group its color.
export type Group =
  | { owner: Seat; kind: 'set'; value: number; cards: Card[] }
  | { owner: Seat; kind: 'run'; start: number; cards: Card[] }
  | { owner: Seat; kind: 'color'; color: CardColor; cards: Card[] };

export type DrawSource = 'pile' | 'discard';

export type Move =
  | { type: 'draw'; source: DrawSource }
  | { type: 'layDown'; groups: number[][]; phase?: number } // card ids, one list per part of the phase, in order; phase is required with "Phases in any order"
  | { type: 'hit'; group: number; cards: number[] } // a group's index on the table
  | { type: 'discard'; card: number; skip: Seat | null }; // whom a Skip skips

// A card drawn from the pile stays secret, so only a discard pick names its card
export type LastMove =
  | { playerNumber: Seat; type: 'draw'; source: 'pile' }
  | { playerNumber: Seat; type: 'draw'; source: 'discard'; card: Card }
  | { playerNumber: Seat; type: 'layDown'; phase: number }
  | { playerNumber: Seat; type: 'hit'; group: number; owner: Seat; kind: GroupKind; count: number }
  | { playerNumber: Seat; type: 'discard'; card: Card; skipped: Seat | null };

// How one player's hand went. Cards left in hand are counted, not shown.
export type SeatSummary = {
  phase: number;      // the phase played this hand; 0 when nothing was laid down under "Phases in any order"
  completed: boolean; // laid it down, so they move on
  cardsLeft: number;
  points: number;
  scoreAfter: number;
};

// Until the game is over, the next hand waits for every connected player to acknowledge it
export type HandSummary = { handNumber: number; wentOut: Seat; seats: Record<Seat, SeatSummary>; acknowledged: Seat[] };

// The full state, which never leaves the server: nobody sees the draw pile or another hand
export type GameState = BaseGameState & {
  handNumber: number;              // 1 for the first hand
  dealer: Seat | null;
  hands: Record<Seat, Card[]>;
  drawPile: Card[];                // drawn from the end
  discardPile: Card[];             // the last card is on top
  groups: Group[];                 // in the order they were laid down
  phases: Record<Seat, number>;    // the phase each player is on; 11 once phase 10 is done (with any order, the lowest not completed)
  phasesDone: Record<Seat, number[]>; // phases completed; saves from before "Phases in any order" lack it, so derive it from phases
  laidPhase: Record<Seat, number>; // the phase each player laid down this hand; saves from before lack it
  scores: Record<Seat, number>;
  skipped: Seat[];                 // players who lose their next turn
  tiebreak: Seat[];                // the tied players replaying phase 10 in a tiebreaker hand; empty otherwise
  drawnBy: Seat | null;            // the current player once they have drawn this turn
  lastMove: LastMove | null;
  handSummary: HandSummary | null;
};

// The game state as the server sends it to one browser: only the viewer's own hand, and counts for the rest
export type PublicGameState = Omit<GameState, 'hands' | 'drawPile' | 'discardPile'> & BasePublicState & {
  myHand: Card[];
  handCounts: Record<Seat, number>;
  drawCount: number;
  discardTop: Card | null;
};
