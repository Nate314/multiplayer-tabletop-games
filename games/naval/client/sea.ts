// What one seat's grid shows: the ships known to the viewer and the shots fired at it
import type { PublicGameState, Seat, Ship, Shot } from '../types.ts';

export const opponentOf = (seat: Seat): Seat => (seat === 1 ? 2 : 1);

// Every fleet once the game is over, the viewer's own before; a fleet never confirmed shows no ships
export function shipsOf(gameState: Pick<PublicGameState, 'revealed' | 'myFleet'>, seat: Seat, viewer: Seat | null): Ship[] {
  return gameState.revealed[seat] ?? (seat === viewer ? gameState.myFleet : null) ?? [];
}

export function shotsAt(gameState: Pick<PublicGameState, 'shots'>, seat: Seat): Shot[] {
  return gameState.shots[opponentOf(seat)];
}
