// The Continue step between rounds: each player acknowledges the round's summary, and the next round starts once
// everyone the game waits for is ready. A game re-checks everyoneReady after a disconnect or a leave.
import { connectedPlayers } from './seating.ts';
import type { BaseGameState, Result, Seat } from './types.ts';

export type Acknowledgeable = { acknowledged: Seat[] };

// Where a game keeps its summary, and the word its status uses for the next round
export type RoundAccess<S extends BaseGameState, M extends Acknowledgeable> = {
  get(state: S): M | null;
  set(state: S, summary: M): S;
  noun: string;
  waitsFor?(state: S): Seat[]; // defaults to the connected players
};

export function everyoneReady<S extends BaseGameState, M extends Acknowledgeable>(state: S, round: RoundAccess<S, M>): boolean {
  const summary = round.get(state);
  if (!summary || state.isGameOver) return false;
  return (round.waitsFor ?? connectedPlayers)(state).every(seat => summary.acknowledged.includes(seat));
}

export function acknowledge<S extends BaseGameState, M extends Acknowledgeable>(
  state: S, seat: Seat, round: RoundAccess<S, M>, startNext: (state: S) => S
): Result<S> {
  const summary = round.get(state);
  if (!summary) return { error: 'Nothing to continue' };
  if (summary.acknowledged.includes(seat)) return { state };
  const next = round.set(
    { ...state, gameStatus: `${state.playerNames[seat]} is ready for the next ${round.noun}` },
    { ...summary, acknowledged: [...summary.acknowledged, seat] }
  );
  return { state: everyoneReady(next, round) ? startNext(next) : next };
}
