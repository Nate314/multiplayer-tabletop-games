// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Result, Seat, UndoVote } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

// The highest pip count on a tile: a double-six or double-nine set
export type SetSize = 6 | 9;

export type End = 'left' | 'right';

// A tile is its index in the set's tile list (see tilesOf), so a tile is one small integer on the wire.
// A placed tile also records its pips as laid in the line, left to right.
export type Placed = { tile: number; left: number; right: number };

export type Move =
  | { type: 'play'; tile: number; end: End } // end is ignored for the first tile
  | { type: 'draw' } // only when no tile in hand fits and the boneyard is not empty
  | { type: 'pass' }; // only when no tile fits and the boneyard is empty

// Not turn-bound and not undoable
export type Action =
  | { type: 'chooseSet'; set: SetSize } // in the lobby only
  | { type: 'acknowledgeRound' };

// `pips` is the tile as it was laid, left to right; `end` is null for the first tile of the round
export type LastMove =
  | { type: 'play'; playerNumber: Seat; tile: number; pips: [number, number]; end: End | null; wentOut: boolean }
  | { type: 'draw'; playerNumber: Seat }
  | { type: 'pass'; playerNumber: Seat };

// How a round went. `winner` is null when a blocked round ended in a tie. Tiles left are counted, not shown.
export type RoundSummary = {
  roundNumber: number;
  winner: Seat | null;
  blocked: boolean;
  points: number;
  pipsLeft: Record<Seat, number>;
  tilesLeft: Record<Seat, number>;
  boneyardPips: number; // counted for the winner only when a player went out
  acknowledged: Seat[]; // the next round waits for every connected player
};

// The full state, which never leaves the server: nobody may see the boneyard or another player's hand
export type GameState = BaseGameState & {
  set: SetSize; // the lobby's choice; locked by the first move
  roundNumber: number;
  scores: Record<Seat, number>;
  hands: Record<Seat, number[]>;
  boneyard: number[]; // the top tile is the last one
  line: Placed[];
  leadTile: number | null; // the tile the first player must lead with; null when any tile may lead
  lastWinner: Seat | null; // leads the next round with any tile
  roundSummary: RoundSummary | null;
  lastMove: LastMove | null;
};

// The game state as the server sends it to one browser: only that player's own hand
export type PublicGameState =
  Omit<GameState, 'hands' | 'boneyard'> &
  BasePublicState & {
    hand: number[]; // the viewer's own hand; empty for the history
    handCounts: Record<Seat, number>;
    boneyardCount: number;
  };
