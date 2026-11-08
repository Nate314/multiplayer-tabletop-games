// Data shapes shared by the browser and the server
import type { Acknowledgeable } from '../../shared/rounds.ts';
import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';

export type { Seat };

export type Entry = { word: string; definition: string };
export type Phase = 'writing' | 'voting' | 'reveal';
export type Choice = { text: string; authors: Seat[]; real: boolean }; // authors empty for the real one
export type Reveal = Acknowledgeable;

export type LastMove =
  | { type: 'write'; playerNumber: Seat }
  | { type: 'closeWriting'; reason: 'allWritten' | 'timeUp' }
  | { type: 'vote'; playerNumber: Seat }
  | { type: 'reveal'; word: string; definition: string }
  | { type: 'nextWord'; round: number };

// The full state, which never leaves the server: nobody sees the deck, and the definition is the secret
export type GameState = BaseGameState & {
  phase: Phase;
  deck: Entry[];
  round: number; // 1-based
  word: string;
  definition: string;
  phaseStartedAt: number | null; // server ms; null in the lobby
  submissions: Partial<Record<Seat, string>>; // private until the reveal
  matched: Seat[]; // wrote the real definition; public from voting on
  choices: Choice[]; // shuffled when writing closes
  votes: Partial<Record<Seat, number>>; // choice index; private until the reveal
  roundPoints: Partial<Record<Seat, number>>; // this word's points, set at the reveal
  scores: Record<Seat, number>;
  reveal: Reveal | null;
  lastMove: LastMove | null;
};

export type ShownChoice = { text: string; authors?: Seat[]; real?: boolean }; // authors and real only from the reveal

export type PublicGameState = Omit<GameState, 'deck' | 'definition' | 'submissions' | 'choices' | 'votes'> & BasePublicState & {
  definition: string | null; // from the reveal on
  written: Seat[]; // who has a submission (writing)
  submission: string | null; // the viewer's own
  choices: ShownChoice[];
  ownChoice: number | null; // the viewer's own fake, which they may not vote for
  voted: Seat[];
  myVote: number | null;
  votes: Partial<Record<Seat, number>>; // every vote from the reveal on, else {}
};
