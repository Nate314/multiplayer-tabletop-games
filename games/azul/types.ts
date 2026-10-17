// Data shapes shared by the browser and the server
import type { BaseGameState } from '../../shared/types.ts';

export type { Result, Seat, UndoVote } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

export type Color = 'blue' | 'yellow' | 'red' | 'black' | 'cyan';

// 'first' is the first-player marker
export type FloorItem = Color | 'first';

export type PatternLine = { color: Color | null; count: number };

export type PlayerBoard = {
  patternLines: PatternLine[]; // 5 lines; line i holds up to i + 1 tiles
  wall: boolean[][];           // 5x5, true where a tile is placed
  floor: FloorItem[];          // at most 7
  score: number;
};

export type Source = { type: 'factory'; index: number } | { type: 'center' };

export type Move = { source: Source; color: Color; line: number | 'floor' };

export type LastMove = Move & { playerNumber: Seat; count: number };

// One tile moved onto the wall at the end of a round, and what it scored
export type Placement = { row: number; col: number; color: Color; points: number; rowRun: number; colRun: number };

// End-of-game bonuses: counts of complete rows, columns and colours, and their total
export type Bonus = { rows: number; columns: number; colors: number; points: number };

export type SeatSummary = {
  scoreBefore: number;
  placements: Placement[];
  floor: FloorItem[];
  floorPenalty: number;  // before the rule that a score never drops below zero
  bonus: Bonus | null;   // only at the end of the game
  scoreAfter: number;
};

// Why everyone scored what they did. Until the game is over, the next round waits for
// every player still in the game to acknowledge it.
export type RoundSummary = { round: number; seats: Record<Seat, SeatSummary>; acknowledged: Seat[] };

// The full state, which never leaves the server: nobody can count the bag
export type GameState = BaseGameState & {
  round: number;
  factories: Color[][];
  center: Color[];
  centerHasMarker: boolean;
  boards: Record<Seat, PlayerBoard>;
  lastMove: LastMove | null;
  roundSummary: RoundSummary | null;
  bag: Color[];
  lid: Color[];
  roundStarter: Seat | null;  // who took the first turn this round
  markerHolder: Seat | null;  // who took the first-player marker this round
};

// The game state as the server sends it to browsers
export type PublicGameState = Omit<GameState, 'bag' | 'lid' | 'roundStarter' | 'markerHolder'> & {
  undoAvailable: boolean;
};
