// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';
import type { Acknowledgeable } from '../../shared/rounds.ts';

export type { Result, Seat, UndoVote } from '../../shared/types.ts';

export type Phase = 'answering' | 'review';
export type Verdict = 'empty' | 'wrongLetter' | 'duplicate' | 'rejected' | 'valid';

// A vote of true rejects the answer
export type Challenge = {
  category: number; seat: Seat; by: Seat;
  votes: Partial<Record<Seat, boolean>>;
  verdict: 'open' | 'rejected' | 'kept';
};
export type Review = Acknowledgeable;

export type LastMove =
  | { type: 'answers'; playerNumber: Seat } // only the first, which starts the game
  | { type: 'done'; playerNumber: Seat }
  | { type: 'closeAnswers'; reason: 'allDone' | 'timeUp' }
  | { type: 'challenge'; playerNumber: Seat; category: number; seat: Seat }
  | { type: 'judge'; playerNumber: Seat; category: number; seat: Seat }
  | { type: 'verdict'; category: number; seat: Seat; rejected: boolean }
  | { type: 'continue'; playerNumber: Seat }
  | { type: 'nextRound'; round: number; letter: string };

// The full state, which never leaves the server: nobody sees the letters still to come or the pool
export type GameState = BaseGameState & {
  phase: Phase;
  round: number;
  letter: string;
  list: string[];
  letters: string[]; // shuffled, still to come
  pool: string[]; // shuffled, still to come
  phaseStartedAt: number | null; // server ms; null in the lobby
  answers: Partial<Record<Seat, string[]>>; // one per category, '' when blank
  done: Seat[];
  challenges: Challenge[];
  review: Review | null;
  scores: Record<Seat, number>;
  lastMove: LastMove | null;
};

export type PublicGameState = Omit<GameState, 'letters' | 'pool' | 'answers'> & BasePublicState & {
  answers: Partial<Record<Seat, string[]>>; // the viewer's own while answering; every seat's in review
  verdicts: Partial<Record<Seat, Verdict[]>>; // review only, else {}
  roundPoints: Partial<Record<Seat, number>>; // review only, else {}
};
