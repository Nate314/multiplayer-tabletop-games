// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';
import type { Contributions, RaceBoards, RaceProgress } from '../../shared/puzzleModes.ts';
import type { Acknowledgeable } from '../../shared/rounds.ts';
import type { Color } from './options.ts';

export type { Random, Result, Seat } from '../../shared/types.ts';
export type { Color } from './options.ts';

export type Feedback = { exact: number; colorOnly: number };
export type Guess = { pegs: Color[]; feedback: Feedback; by: Seat };
export type Board = { guesses: Guess[]; broken: boolean }; // finished = broken || guesses.length === MAX_GUESSES

export type RoundResult = { round: number; maker: Seat; breaker: Seat; code: Color[]; guesses: number; broken: boolean; points: number };
export type RoundSummary = RoundResult & Acknowledgeable;

export type LastMove =
  | { type: 'setCode'; playerNumber: Seat }
  | { type: 'guess'; playerNumber: Seat; feedback: Feedback; broken: boolean; outOfGuesses: boolean }
  | { type: 'raceGuess'; playerNumber: Seat; guessNumber: number; broken: boolean } // no pegs or feedback
  | { type: 'undoOwn'; playerNumber: Seat };

export type GameState = BaseGameState & {
  phase: 'setting' | 'breaking' | 'summary'; // 'setting' and 'summary' are Classic only
  code: Color[] | null; // the secret; null in Classic until the maker sets it
  maker: Seat | null; // Classic: this round's maker; null when the computer made the code
  round: number; // Classic: 1 to 4; else 1
  board: Board; // Classic, Solo, Together
  boards: RaceBoards<Board>; // Race only, one per seat
  finishOrder: Seat[]; // Race: seats in the order their boards finished
  points: Partial<Record<Seat, number>>; // Classic totals
  rounds: RoundResult[]; // Classic, finished rounds
  summary: RoundSummary | null; // Classic, between rounds
  contributions: Contributions; // Together: guesses per seat
  lastMove: LastMove | null;
};

export type PublicGameState = Omit<GameState, 'code' | 'boards'> & BasePublicState & {
  code: Color[] | null; // the maker's own code, or everyone's once revealed; else null
  boards: RaceBoards<Board>; // visibleBoards, or every board for a spectator
  progress: RaceProgress; // Race: every seat
  guessesUsed: Partial<Record<Seat, number>>; // Race: every seat
};
