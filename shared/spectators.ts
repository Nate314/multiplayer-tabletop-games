import type { GameDefinition } from './gameDefinition.ts';
import type { BaseGameState, BasePublicState, HandRequest, Seat, Spectator } from './types.ts';

export const MAX_SPECTATORS = 20;

// Picks the seat-dependent fields out of a seat's own view; the helper each game's privateSeatView uses
export function seatFields<T, K extends keyof T>(view: T, keys: K[]): Pick<T, K> {
  const picked = {} as Pick<T, K>;
  for (const key of keys) picked[key] = view[key];
  return picked;
}

// The table view plus the private view of each seat that allowed this spectator; spectators never undo
export function spectatorView<S extends BaseGameState, P extends BasePublicState>(
  definition: GameDefinition<S, P>, state: S, spectator: Spectator
): Omit<P, 'moveCount'> {
  const view = definition.spectatorState?.(state, false, spectator.tableScreen) ?? definition.toPublicState(state, false, null);
  const { privateSeatView } = definition;
  if (!privateSeatView || definition.spectatorsSeeEverySeat) return view; // no field at all tells the browser there is nothing to ask for
  const seatViews: Record<Seat, unknown> = {};
  for (const seat of spectator.allowedSeats) {
    if (state.activePlayers.includes(seat)) seatViews[seat] = privateSeatView(state, seat);
  }
  return { ...view, seatViews };
}

// Requests still worth asking: the seat is seated, the spectator is connected and the game is on
export function openHandRequests(state: BaseGameState, connected: ReadonlySet<string>): HandRequest[] {
  if (state.isGameOver) return [];
  return (state.handRequests ?? []).filter(request =>
    state.activePlayers.includes(request.seat) && connected.has(request.spectator));
}
