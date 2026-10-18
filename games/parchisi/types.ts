// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Random, Result, Seat } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

// A pawn is a number of squares travelled from its entry square: NEST (-1), 0-63 on the track,
// 64-70 in its home column and HOME (71) at the center
export type Progress = number;

export type Die = { value: number; used: boolean };

// What a move spends: one die by index, both dice on one pawn (their total), or the oldest bonus
export type DieChoice = number | 'total' | 'bonus';

export type Move = { type: 'move'; pawn: number; die: DieChoice };

export type PawnRef = { seat: Seat; pawn: number };

// A move by the total can capture twice: where the first die lands and where the second does
export type LegalMove = { pawn: number; die: DieChoice; steps: number; to: Progress; captured: PawnRef[] };

export type LastMove = {
  playerNumber: Seat;
  pawn: number;
  from: Progress;
  to: Progress;
  steps: number;
  captured: PawnRef[];
};

export type GameState = BaseGameState & {
  pawns: Record<Seat, Progress[]>; // a player who left has no entry
  dice: Die[]; // the current roll, empty until two players are seated; doubles may add the two faces underneath
  bonuses: number[]; // bonus moves earned this turn and not used yet, oldest first
  roller: Seat | null; // who the dice were rolled for
  doublesRolled: number; // doubles in a row this turn, including the current roll
  splitBlockades: Progress[]; // squares the roller's blockades were split from this doubles roll; the other pawn stays
  lastMove: LastMove | null;
};

// The game state as the server sends it to browsers
export type PublicGameState = GameState & BasePublicState;
