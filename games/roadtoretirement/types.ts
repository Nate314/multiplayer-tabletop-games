// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';

export type { Random, Result, Seat } from '../../shared/types.ts';

export type Board = 'road' | 'checkered';
export type Cell = { row: number; col: number }; // row 0 is the top

export type RoadPlayer = {
  space: number; cash: number; loans: number; // loans: count of LOAN_UNIT taken
  career: string | null; degree: boolean; houses: string[];
  partner: boolean; children: number; retired: boolean; worth: number | null; // worth set on retiring
};
export type RoadPhase = 'route' | 'spin' | 'fork' | 'career' | 'house';
export type RoadState = { players: Record<Seat, RoadPlayer>; phase: RoadPhase; stepsLeft: number; offer: string[] };

export type CheckeredState = {
  pieces: Record<Seat, Cell>; points: Record<Seat, number>; skipNext: Seat[];
  phase: 'spin' | 'choose'; options: Cell[];
};

export type Move =
  | { type: 'route'; choice: 'college' | 'work' }
  | { type: 'spin' }
  | { type: 'fork'; road: 'safe' | 'fast' }
  | { type: 'career'; pick: string | null } // null keeps the current career
  | { type: 'buyHouse'; pick: string | null } // null buys nothing
  | { type: 'step'; to: Cell }; // 1860 board

export type LastMove = { type: Move['type']; playerNumber: Seat; spin?: number; events: string[] }; // events: plain sentences

export type GameState = BaseGameState & {
  board: Board; road: RoadState | null; checkered: CheckeredState | null;
  spin: number | null; lastMove: LastMove | null;
};
export type PublicGameState = GameState & BasePublicState;
