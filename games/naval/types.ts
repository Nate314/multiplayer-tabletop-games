// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';
import type { DrawOfferState, EndingAction } from '../../shared/drawOffer.ts';

export type { Result, Seat } from '../../shared/types.ts';

export type ShipLength = 2 | 3 | 4 | 5;

// Row 0 is A and col 0 is 1
export type Cell = { row: number; col: number };

// row, col: the top or left end
export type Ship = { length: ShipLength; row: number; col: number; orientation: 'across' | 'down' };

export type Shot = { row: number; col: number; result: 'miss' | 'hit' | 'sunk'; sunkLength?: ShipLength };

export type Phase = 'placing' | 'firing';

export type LastMove = { type: 'fire'; playerNumber: Seat; shots: Shot[] };

export type Move = { type: 'fire'; targets: Cell[] };

export type Action = { type: 'place'; ships: Ship[] } | EndingAction;

export type GameState = BaseGameState & DrawOfferState & {
  phase: Phase;
  fleets: Partial<Record<Seat, Ship[]>>; // confirmed fleets only; never in a view before game over
  shots: Record<Seat, Shot[]>; // shots fired BY each seat, in order
  lastMove: LastMove | null;
};

export type PublicGameState = Omit<GameState, 'fleets'> & BasePublicState & {
  ready: Seat[]; // seats whose fleet is confirmed
  myFleet: Ship[] | null; // the viewer's own confirmed fleet; null for viewer null or not yet confirmed
  revealed: Partial<Record<Seat, Ship[]>>; // every confirmed fleet once isGameOver, {} before
};
