// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Random, Result, Seat } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

export type Move = { type: 'roll' };

export type LastMove = {
  type: 'roll'; // the platform's sounds play the dice for lastMove.type 'roll'
  playerNumber: Seat;
  roll: number;
  from: number;
  landed: number; // from + roll, capped at 100; equals from when stayed
  to: number;
  via: 'ladder' | 'snake' | null;
  stayed: boolean; // Exact finish kept the token in place
  again: boolean; // a 6 that did not win: the same player rolls next
};

export type GameState = BaseGameState & {
  positions: Record<Seat, number>; // a player who left has no entry
  lastMove: LastMove | null;
};

export type PublicGameState = GameState & BasePublicState;
