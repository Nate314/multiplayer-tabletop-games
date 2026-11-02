// Which seat plays X. X always moves first, and each rematch swaps the marks.
import type { BaseGameState, Seat } from '../../shared/types.ts';

export type Mark = 'X' | 'O';
export type MarkState = { xSeat: Seat };

export function xSeatFor(gameNumber: number | undefined): Seat {
  return (gameNumber ?? 1) % 2 === 0 ? 2 : 1;
}

export function markOf(state: MarkState, seat: Seat): Mark {
  return seat === state.xSeat ? 'X' : 'O';
}

// Used as resetLobby: sets the X seat for this game, and hands the first turn to it once it is seated
export function withFirstMark<S extends BaseGameState & MarkState>(state: S): S {
  const xSeat = xSeatFor(state.gameNumber);
  return {
    ...state,
    xSeat,
    currentPlayer: state.activePlayers.includes(xSeat) ? xSeat : state.currentPlayer,
  };
}
