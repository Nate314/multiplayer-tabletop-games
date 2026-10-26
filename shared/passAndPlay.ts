import type { GameDefinition } from './gameDefinition.ts';
import { connectedPlayers } from './seating.ts';
import type { BaseGameState, Seat } from './types.ts';

// Every seat the table waits on: the turn, the game's out-of-turn waits, open votes and hand requests
export function seatsToAct(game: Pick<GameDefinition, 'waitingOn'>, state: BaseGameState): Seat[] {
  const seats = new Set<Seat>(state.isGameOver || state.currentPlayer === null ? [] : [state.currentPlayer]);
  for (const seat of game.waitingOn?.(state) ?? []) seats.add(seat);
  for (const vote of [state.undoVote, state.dismissVote]) {
    if (vote) for (const seat of connectedPlayers(state)) if (!(seat in vote.votes)) seats.add(seat);
  }
  for (const request of state.handRequests ?? []) seats.add(request.seat);
  return [...seats].sort((a, b) => a - b);
}

// Which local seat a shared device shows. A private hand is hidden (null) between turns so the next player can take the device.
export function nextShownSeat(shown: Seat | null, localSeats: Seat[], waiting: Seat[], hasPrivate: boolean): Seat | null {
  const waitingLocal = localSeats.filter(seat => waiting.includes(seat));
  if (!hasPrivate) return waitingLocal[0] ?? shown;
  if (shown !== null && waitingLocal.includes(shown)) return shown;
  return waitingLocal.length > 0 ? null : shown;
}
