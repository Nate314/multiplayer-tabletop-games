import type { GameCategory } from './categories.ts';
import type { HouseRule, PlayerRange } from './houseRules.ts';
import type { BaseGameState, BasePublicState, Random, Result, Seat } from './types.ts';

export type GameInfo = {
  id: string; // lowercase, used in messages and as data-game
  name: string;
  category: GameCategory; // which landing page group lists it
  description: string; // one line for the landing page
  minPlayers: number;
  maxPlayers: number;
  houseRules?: HouseRule[];
  stretchedPlayers?: PlayerRange; // allowed with the player-count override; contains minPlayers..maxPlayers
};

// Everything a game supplies; seating, turn order and undo are handled by the platform
export type GameDefinition<S extends BaseGameState = BaseGameState, P extends BasePublicState = BasePublicState> = {
  info: GameInfo;
  createGameState(gameId: string): S;
  // Before the first move, after anyone joins or leaves. currentPlayer is already activePlayers[0].
  resetLobby(state: S, random: Random): S;
  // Mid-game, after the platform has removed `seat` and moved the turn on; only while 2+ remain and the game is not over.
  onPlayerLeft?(state: S, seat: Seat, random: Random): S;
  // Mid-game, after the platform marked `seat` disconnected and settled votes.
  onPlayerDisconnected?(state: S, seat: Seat, random: Random): S;
  // After an approved undo, on the restored state. A game reshuffles its face-down piles here, so a player cannot
  // undo a draw to learn what comes next.
  onUndo?(state: S, random: Random): S;
  // Called only after the platform's turn guards pass. Validates untrusted `move`.
  // `random` is for dice and reshuffles; an undo restores the state before the move, so a replayed move may roll differently.
  applyMove(state: S, seat: Seat, move: unknown, random: Random): Result<S>;
  // Not turn-bound and not recorded for undo. Validates untrusted `action`.
  // The platform does not block actions during an undo vote or after the game is over; the game must refuse them itself where needed.
  applyAction?(state: S, seat: Seat, action: unknown, random: Random): Result<S>;
  // The platform adds moveCount; a game never supplies it.
  // `viewer` is the seat the view is sent to, so a game can show a player their own hand; null (the history) sees no hand.
  toPublicState(state: S, undoAvailable: boolean, viewer: Seat | null): Omit<P, 'moveCount'>;
};
