import type { GameDefinition } from './gameDefinition.ts';
import { connectedPlayers } from './seating.ts';
import type { BaseGameState, Seat } from './types.ts';

// Every seat the table waits on: the game's out-of-turn waits (or else the turn) and open votes. A spectator's hand request is
// left out: answering it is optional, so it must never keep one player's hand on a shared device past their turn.
// An out-of-turn choice (a Catan discard, a trade answer) comes before the turn, so a shared device hands over one player at a time.
export function seatsToAct(game: Pick<GameDefinition, 'waitingOn'>, state: BaseGameState): Seat[] {
  const outOfTurn = game.waitingOn?.(state) ?? [];
  const turn = outOfTurn.length > 0 || state.isGameOver || state.currentPlayer === null ? [] : [state.currentPlayer];
  const seats = new Set<Seat>([...turn, ...outOfTurn]);
  for (const vote of [state.undoVote, state.dismissVote]) {
    if (vote) for (const seat of connectedPlayers(state)) if (!(seat in vote.votes)) seats.add(seat);
  }
  return [...seats].sort((a, b) => a - b);
}

// Which local seat a shared device shows. A private hand is hidden (null) between turns so the next player can take the device.
export function nextShownSeat(shown: Seat | null, localSeats: Seat[], waiting: Seat[], hasPrivate: boolean): Seat | null {
  const waitingLocal = localSeats.filter(seat => waiting.includes(seat));
  if (!hasPrivate) return waitingLocal[0] ?? shown;
  if (shown !== null && waitingLocal.includes(shown)) return shown;
  return waitingLocal.length > 0 ? null : shown;
}
