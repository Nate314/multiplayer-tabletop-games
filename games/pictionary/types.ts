// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Result, Seat, UndoVote } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

export type Phase = 'choosing' | 'drawing' | 'reveal';
export type Tool = 'pen' | 'eraser';

export type Stroke =
  | { id: number; kind: 'line'; tool: Tool; color: number; size: 0 | 1 | 2; points: number[] } // flat x,y pairs, integers 0..CANVAS_W/H
  | { id: number; kind: 'fill'; color: number; x: number; y: number };

export type ChatLine = {
  id: number;
  kind: 'chat' | 'guessed' | 'close' | 'system';
  seat: Seat | null;
  text: string;
  audience: 'all' | 'guessed' | Seat; // 'guessed': drawer, guessed seats and spectators; a Seat: that seat only
};

export type LastMove =
  | { type: 'choose'; playerNumber: Seat }
  | { type: 'guess'; playerNumber: Seat; points: number }
  | { type: 'reveal'; word: string; reason: 'allGuessed' | 'timeUp' | 'drawerLeft' }
  | { type: 'nextTurn'; playerNumber: Seat }
  | { type: 'autoChoose'; playerNumber: Seat };

// The full state, which never leaves the server: nobody sees the deck, and guessers do not see the word
export type GameState = BaseGameState & {
  phase: Phase;
  deck: string[];
  wordChoices: string[];
  word: string | null;
  // Who draws this turn. It is currentPlayer until the drawer leaves, when the platform moves currentPlayer on
  // and the next turn still has to follow the leaver's seat
  drawer: Seat | null;
  phaseStartedAt: number | null; // server ms; null in the lobby
  strokes: Stroke[];
  nextStrokeId: number;
  guessed: Seat[]; // in guessing order
  scores: Record<Seat, number>;
  draws: Record<Seat, number>; // turns drawn so far
  chat: ChatLine[];
  nextChatId: number;
  lastMove: LastMove | null;
};

export type PublicGameState = Omit<GameState, 'deck' | 'wordChoices' | 'word' | 'chat'> & BasePublicState & {
  mask: string; // the word with every letter as '_', spaces and hyphens kept
  word: string | null; // only to the drawer, a seat in `guessed`, and everyone during the reveal or game over
  wordChoices: string[]; // only to the drawer while choosing
  chat: ChatLine[]; // only the lines this viewer may see
};
