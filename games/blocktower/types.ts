import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';

export type { Result, Seat } from '../../shared/types.ts';

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type Pose = { p: Vec3; q: Quat };
export type Slot = 0 | 1 | 2;

// w is the spin in rad/s about +Y; drive is the speed the turning player asks for, null once they let go and it coasts
export type Turntable = { q: Quat; w: number; drive: number | null };

// level is where the block was placed, kept even after it falls
export type Block = { id: number; level: number; pose: Pose; v?: Vec3; w?: Vec3 };

// anchor is block-local; target is world, at the anchor's height
export type Grab = { block: number; anchor: Vec3; target: Vec3 };

// The seat pulling this turn and the block they grabbed last, the one block the topple check ignores;
// block is null when the turn so far is only turning the turntable
export type Pull = { seat: Seat; block: number | null };
// ticks counts from the first grab, or from the topple once the tower has toppled
export type Sim = { ticks: number; calmTicks: number; sinceRelease: number };
// free marks a block set down under Free placement rather than placed into a slot
export type LastMove = { type: 'place'; seat: Seat; block: number; level: number; from: Pose; to: Pose; free?: true } | { type: 'topple'; seat: Seat };

// grip is each block's friction by id and never leaves the server; turnStart is the tower the topple check compares with
export type GameState = BaseGameState & {
  blocks: Block[];
  grip: number[];
  turnStart: Block[];
  phase: 'pull' | 'place';
  grab: Grab | null;
  held: number | null;
  pull: Pull | null;
  sim: Sim | null;
  toppled: boolean;
  loser: Seat | null;
  placed: Record<Seat, number>;
  lastMove: LastMove | null;
  turntable?: Turntable;
  // The turntable's rotation when turnStart was taken; the topple check and an undo use both together
  turnStartTurntable?: Quat;
  // The block set on top under Free placement and still settling; the physics then decides if it stayed
  dropping?: number | null;
};

export type PublicGameState = Omit<GameState, 'grip' | 'turnStart' | 'turnStartTurntable'> & BasePublicState;

export type Action =
  | { type: 'grab'; block: number; anchor: Vec3 }
  | { type: 'drag'; target: Vec3 }
  | { type: 'release' }
  | { type: 'turn'; speed: number | null };
// at is x and z in the turntable's frame
export type Move = { type: 'place'; slot: Slot } | { type: 'drop'; at: [number, number] };
