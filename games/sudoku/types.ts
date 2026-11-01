// Data shapes shared by the browser and the server
import type { RaceBoards } from '../../shared/puzzleModes.ts';
import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';
import type { Difficulty } from './options.ts';

export type { Result, Seat } from '../../shared/types.ts';

// 81 cells each; an entry of 0 is empty, and givens are never in entries
export type Board = { entries: number[]; by: (Seat | null)[] };

// One seat's own entry or erase, kept so that seat can take it back; an `after` of 0 is an erase
export type OwnMove = { cell: number; before: number; beforeBy: Seat | null; after: number };

export type LastMove =
  | { type: 'enter'; playerNumber: Seat; cell: number; digit: number; finished?: true }
  | { type: 'erase' | 'undoOwn'; playerNumber: Seat; cell: number };

// Solo sends entries as moves; Together and Race send them as actions
export type Entry = { type: 'enter'; cell: number; digit: number } | { type: 'erase'; cell: number };

export type GameState = BaseGameState & {
  difficulty: Difficulty;
  givens: number[];
  solution: number[];
  board: Board; // Solo and Together
  raceBoards: RaceBoards<Board>; // Race, one per seat
  notes: Partial<Record<Seat, number[]>>; // 81 bitmasks per seat, bit d for digit d
  ownMoves: Partial<Record<Seat, OwnMove[]>>; // Together and Race
  showMistakes: boolean; // Solo
  raceWrong: Partial<Record<Seat, true>>; // a full Race board that is wrong
  lastMove: LastMove | null;
};

// The game state as the server sends it to browsers
export type PublicGameState = Omit<GameState, 'solution'> & BasePublicState;
