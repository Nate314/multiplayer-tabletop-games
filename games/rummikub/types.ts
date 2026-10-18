// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Result, Seat, UndoVote } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

export type TileColor = 'black' | 'blue' | 'orange' | 'red';

// Every tile has a stable id from 0 to 105, so a rearranged table can be checked tile by tile.
// Racks, the pool and the table hold ids; tileOf in rules.ts turns an id into its tile.
export type Tile =
  | { id: number; kind: 'number'; value: number; color: TileColor }
  | { id: number; kind: 'joker' };

// The whole table as groups of tile ids. A run is kept in order from its lowest number,
// so a joker in it stands for the number its place gives it.
export type Table = number[][];

export type Move =
  | { type: 'play'; table: Table } // the table as it should be at the end of the turn
  | { type: 'draw' };

// `added` are the rack tiles the play put on the table; they are public once played.
// `meld` is the total of a first meld, null for a later play. A draw from an empty pool is a pass.
export type LastMove =
  | { type: 'play'; playerNumber: Seat; added: number[]; meld: number | null; wentOut: boolean }
  | { type: 'draw'; playerNumber: Seat; drew: boolean };

// How the round ended: who went out (null when the pool ran out and nobody could play),
// what each rack still held, and what each player scores for the round
export type RoundResult = {
  wentOut: Seat | null;
  rackTotals: Record<Seat, number>;
  tileCounts: Record<Seat, number>;
  points: Record<Seat, number>;
};

// The full state, which never leaves the server: nobody sees another rack or the pool
export type GameState = BaseGameState & {
  table: Table;
  racks: Record<Seat, number[]>;
  pool: number[]; // drawn from the end
  melded: Seat[]; // players who have made their first meld, in the order they made it
  emptyPoolPasses: number; // turns passed in a row since the pool ran out
  lastMove: LastMove | null;
  result: RoundResult | null;
};

// The game state as the server sends it to one browser: its own rack, and only counts for the rest
export type PublicGameState = Omit<GameState, 'racks' | 'pool'> & BasePublicState & {
  rack: number[]; // the viewer's rack; empty for the table view
  rackCounts: Record<Seat, number>;
  poolCount: number;
};
