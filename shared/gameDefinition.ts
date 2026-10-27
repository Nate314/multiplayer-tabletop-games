import type { GameCategory } from './categories.ts';
import type { HouseRule, PlayerRange } from './houseRules.ts';
import type { BaseGameState, BasePublicState, Random, Result, Seat, Standing } from './types.ts';

export const SIMULATION_TICK_MS = 50;

export type GameInfo = {
  id: string; // lowercase, used in messages and as data-game
  name: string;
  category: GameCategory; // which landing page group lists it
  description: string; // one line for the landing page
  minPlayers: number;
  maxPlayers: number;
  houseRules?: HouseRule[];
  ownTurnLimit?: true; // the game enforces its own turn limit, so the platform turn timer is not offered
  passAndPlay?: boolean; // false when players cannot share one device (a hidden word the others must guess)
  stretchedPlayers?: PlayerRange; // the table the host may set as a house rule; contains minPlayers..maxPlayers
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
  // `now` is the server's time in ms, for games with a clock; other games ignore it.
  applyMove(state: S, seat: Seat, move: unknown, random: Random, now: number): Result<S>;
  // Timed rules. `deadline` is the server time in ms when `onDeadline` must run, or null for none. The platform
  // records `onDeadline` as a move by currentPlayer, so it can be undone. `resumeClock` restarts a clock from `now`:
  // once everyone has agreed to the house rules, after an approved undo, and on load after a restart.
  deadline?(state: S): number | null;
  onDeadline?(state: S, now: number, random: Random): S;
  resumeClock?(state: S, now: number): S;
  // Live simulation. While `simulating(state)` is true the platform calls `simulate` every SIMULATION_TICK_MS,
  // broadcasts the result and neither records it nor writes it to the store, except a tick that ends the game,
  // which is recorded as a move like a deadline. The state is saved once simulating turns false.
  simulating?(state: S): boolean;
  simulate?(state: S): S;
  // Called only when `seat` is not currentPlayer, after every other turn guard passed. True lets applyMove run for this
  // out-of-turn move, which is recorded for undo like any other. Validates untrusted `move`.
  allowsOutOfTurn?(state: S, seat: Seat, move: unknown): boolean;
  // Not turn-bound, and recorded for undo only when recordsAction says so. Validates untrusted `action`.
  // The platform does not block actions during an undo vote or after the game is over; the game must refuse them itself where needed.
  applyAction?(state: S, seat: Seat, action: unknown, random: Random, now: number): Result<S>;
  // Asked before applyAction: true records the action's result as a move (history, timeline, undo), like a move.
  recordsAction?(state: S, seat: Seat, action: unknown): boolean;
  // Seats the game waits on besides currentPlayer (a pass, a discard, a trade answer, a round summary Continue).
  waitingOn?(state: S): Seat[];
  // Called only once isGameOver. Ranks by what chose `winners`, so place 1 is exactly the winners.
  finalStandings?(state: S): Standing[];
  // The platform adds moveCount; a game never supplies it.
  // `viewer` is the seat the view is sent to, so a game can show a player their own hand; null (the history) sees no hand.
  toPublicState(state: S, undoAvailable: boolean, viewer: Seat | null): Omit<P, 'moveCount'>;
  // Everything `toPublicState` shows only to `seat`; a spectator sees it once that seat allows.
  privateSeatView?(state: S, seat: Seat): unknown;
  // True when an ordinary spectator's view already shows what every seat's privateSeatView would, so there is nothing to ask for
  spectatorsSeeEverySeat?: boolean;
  // A spectator's table view when it differs from toPublicState(state, undoAvailable, null)
  spectatorState?(state: S, undoAvailable: boolean, tableScreen: boolean): Omit<P, 'moveCount'>;
};
