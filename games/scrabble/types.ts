// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Result, Seat, UndoVote } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

// A rack or bag tile: a letter 'A' to 'Z', or BLANK
export type RackTile = string;

// A tile on the board. A blank shows the letter its player chose and is worth 0.
export type BoardTile = { letter: string; blank: boolean };

export type Board = (BoardTile | null)[][]; // 15x15, [row][col]

export type Premium = 'DL' | 'TL' | 'DW' | 'TW';

// One tile put down in a play; `blank` means it is a blank standing for `letter`
export type Placement = { row: number; col: number; letter: string; blank?: boolean };

export type Move =
  | { type: 'play'; tiles: Placement[] }
  | { type: 'exchange'; letters: RackTile[] }
  | { type: 'pass' };

export type ScoredWord = { word: string; points: number };

// What a play scores: every word it forms, the bingo bonus and the total
export type ScoredPlay = { words: ScoredWord[]; bingo: boolean; points: number };

export type LastMove =
  | ({ type: 'play'; playerNumber: Seat; tiles: Placement[] } & ScoredPlay)
  | { type: 'exchange'; playerNumber: Seat; count: number }
  | { type: 'pass'; playerNumber: Seat };

// The full state, which never leaves the server: nobody sees another rack or the bag
export type GameState = BaseGameState & {
  board: Board;
  racks: Record<Seat, RackTile[]>;
  bag: RackTile[];
  scores: Record<Seat, number>;
  scorelessTurns: number; // passes, exchanges and zero-point plays in a row
  lastMove: LastMove | null;
  endAdjustments: Record<Seat, number> | null; // the rack points each score gained or lost when the game ended
};

// The game state as the server sends it to one browser: its own rack, and only counts for the rest
export type PublicGameState = Omit<GameState, 'racks' | 'bag'> & BasePublicState & {
  rack: RackTile[]; // the viewer's rack; empty for the history
  rackCounts: Record<Seat, number>;
  bagCount: number;
};
