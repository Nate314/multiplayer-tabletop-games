// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';
import type { RaceBoards } from '../../shared/puzzleModes.ts';
import type { Layout } from './board.ts';

export type { Result, Seat } from '../../shared/types.ts';

// placed maps a filled hole to the tray index in it; turns[i] is tray shape i's rotation in 45 degree steps
export type SeatBoard = { placed: Partial<Record<number, number>>; turns: number[] };

// raceStartedAt and finishTimes, not startedAt and finishedAt: the platform owns those two names on every state
export type GameState = BaseGameState & {
  layout: Layout | null;
  boards: RaceBoards<SeatBoard>;
  raceStartedAt: number | null; // server ms the clock started
  finishTimes: Partial<Record<Seat, number>>; // ms after raceStartedAt each seat filled its board
  popped: boolean; // the race ended on the timer
};

export type PublicGameState = BasePublicState & GameState & {
  placedCounts: Partial<Record<Seat, number>>;
  endsAt: number | null;
};
