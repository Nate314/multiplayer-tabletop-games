// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Result, Seat } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

// `keep` holds indexes into the current roll. It is empty only for the first roll of a turn.
export type Move =
  | { type: 'roll'; keep: number[] }
  | { type: 'bank'; keep: number[] };

// `kept` is the dice set aside by the move and `points` what they scored. A roll has the dice it threw, `hot` when
// setting aside all six earned a fresh six, and `farkle` with the turn total lost when nothing in the throw scored.
// A bank has the `total` added to the player's score.
export type LastMove =
  | { type: 'roll'; playerNumber: Seat; kept: number[]; points: number; dice: number[]; hot: boolean; farkle: boolean; lost: number }
  | { type: 'bank'; playerNumber: Seat; kept: number[]; points: number; total: number };

export type GameState = BaseGameState & {
  scores: Record<Seat, number>;
  dice: number[]; // the player's current roll; empty until they have rolled this turn
  setAside: number[]; // dice kept so far this turn, until hot dice start over
  turnTotal: number; // points from the dice set aside this turn, lost on a farkle
  triggeredBy: Seat | null; // who reached the target, which gives everyone else one last turn
  finalTurns: Seat[]; // seats still owed their last turn
  lastMove: LastMove | null;
};

export type PublicGameState = GameState & BasePublicState;
