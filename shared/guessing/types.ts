// Data shapes of a guessing game (one player draws or acts, the rest guess in the chat), shared by the browser and the server.
// The field names are a drawing game's: in an acting game `drawer` is the actor, `word` the prompt and 'drawing' is acting
import type { BaseGameState, BasePublicState, Seat } from '../types.ts';

export type Phase = 'choosing' | 'drawing' | 'reveal';

export type ChatLine = {
  id: number;
  kind: 'chat' | 'guessed' | 'close' | 'system';
  seat: Seat | null;
  text: string;
  audience: 'all' | 'guessed' | Seat; // 'guessed': drawer, guessed seats and spectators; a Seat: that seat only
};

export type GuessLastMove =
  | { type: 'choose'; playerNumber: Seat }
  | { type: 'guess'; playerNumber: Seat; points: number }
  | { type: 'reveal'; word: string; reason: 'allGuessed' | 'timeUp' | 'drawerLeft' }
  | { type: 'nextTurn'; playerNumber: Seat }
  | { type: 'autoChoose'; playerNumber: Seat };

// The full state, which never leaves the server: nobody sees the deck, and guessers do not see the word
export type GuessState = BaseGameState & {
  phase: Phase;
  deck: string[];
  wordChoices: string[];
  word: string | null;
  // Who draws this turn. It is currentPlayer until the drawer leaves, when the platform moves currentPlayer on
  // and the next turn still has to follow the leaver's seat
  drawer: Seat | null;
  phaseStartedAt: number | null; // server ms; null in the lobby
  guessed: Seat[]; // in guessing order
  scores: Record<Seat, number>;
  draws: Record<Seat, number>; // turns drawn so far
  chat: ChatLine[];
  nextChatId: number;
  lastMove: GuessLastMove | null;
};

export type GuessPublic<S extends GuessState> = Omit<S, 'deck' | 'wordChoices' | 'word' | 'chat'> & BasePublicState & {
  mask: string; // the word with every letter as '_', spaces and hyphens kept
  word: string | null; // only to the drawer, a seat in `guessed`, and everyone during the reveal or game over
  wordChoices: string[]; // only to the drawer while choosing
  chat: ChatLine[]; // only the lines this viewer may see
};
