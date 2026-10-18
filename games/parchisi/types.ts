// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Random, Result, Seat } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

// A pawn is a number of squares travelled from its entry square: NEST (-1), 0-63 on the track,
// 64-70 in its home column and HOME (71) at the center
export type Progress = number;

export type Die = { value: number; used: boolean };

// What a move spends: one die by index, both dice together (a sum of 5, to enter), or the oldest bonus
export type DieChoice = 0 | 1 | 'sum' | 'bonus';

export type Move = { type: 'move'; pawn: number; die: DieChoice };

export type PawnRef = { seat: Seat; pawn: number };

export type LegalMove = { pawn: number; die: DieChoice; steps: number; to: Progress; captured: PawnRef | null };

export type LastMove = {
  playerNumber: Seat;
  pawn: number;
  from: Progress;
  to: Progress;
  steps: number;
  captured: PawnRef | null;
};

export type GameState = BaseGameState & {
  pawns: Record<Seat, Progress[]>; // a player who left has no entry
  dice: Die[]; // the current roll, empty until two players are seated
  bonuses: number[]; // bonus moves earned this turn and not used yet, oldest first
  roller: Seat | null; // who the dice were rolled for
  doublesRolled: number; // doubles in a row this turn, including the current roll
  lastMove: LastMove | null;
};

// The game state as the server sends it to browsers
export type PublicGameState = GameState & BasePublicState;
