import type { BaseGameState, BasePublicState, Random, Result, Seat } from './types.ts';

export type GameInfo = {
  id: string; // lowercase, used in messages and as data-game
  name: string;
  description: string; // one line for the landing page
  minPlayers: number;
  maxPlayers: number;
};

// Everything a game supplies; seating, turn order and undo are handled by the platform
export type GameDefinition<S extends BaseGameState = BaseGameState, P extends BasePublicState = BasePublicState> = {
  info: GameInfo;
  createGameState(gameId: string): S;
  // Before the first move, after anyone joins or leaves. currentPlayer is already activePlayers[0].
  resetLobby(state: S, random: Random): S;
  // Mid-game, after the platform has removed `seat` and moved the turn on; only while 2+ remain and the game is not over.
  onPlayerLeft?(state: S, seat: Seat, random: Random): S;
  // Called only after the platform's turn guards pass. Validates untrusted `move`.
  applyMove(state: S, seat: Seat, move: unknown): Result<S>;
  // Not turn-bound and not recorded for undo. Validates untrusted `action`.
  // The platform does not block actions during an undo vote or after the game is over; the game must refuse them itself where needed.
  applyAction?(state: S, seat: Seat, action: unknown, random: Random): Result<S>;
  toPublicState(state: S, undoAvailable: boolean): P;
};
