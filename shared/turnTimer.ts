import { houseRule, TURN_TIMER } from './houseRules.ts';
import type { BaseGameState, Seat } from './types.ts';

export function turnLimitMs(state: Pick<BaseGameState, 'houseRules'>): number {
  return houseRule(state, TURN_TIMER) * 1000;
}

// The one list of votes that pause the turn timer; hand requests involve two people only, so they never do
export function votePauses(state: BaseGameState): boolean {
  return !!state.undoVote || !!state.dismissVote || !!state.rematchVote;
}

// Stamps the live state with when the current turn began and whether a vote has paused it. The clock only
// displays: it restarts for each new current player and is shifted later by the time a vote held it
export function stampTurn(
  state: BaseGameState, clockSeat: Seat | null | undefined, running: boolean, now: number
): { state: BaseGameState; clockSeat: Seat | null } {
  if (turnLimitMs(state) === 0) { // off: no stamp keys at all, so views and files are what they were before the rule
    if (!('turnStartedAt' in state) && !('turnPausedAt' in state)) return { state, clockSeat: null };
    const { turnStartedAt: _started, turnPausedAt: _paused, ...bare } = state;
    return { state: bare, clockSeat: null };
  }
  if (!running) {
    const stamped = state.turnStartedAt != null || state.turnPausedAt != null;
    return { state: stamped ? { ...state, turnStartedAt: null, turnPausedAt: null } : state, clockSeat: null };
  }
  const { currentPlayer, turnStartedAt, turnPausedAt } = state;
  const voting = votePauses(state);
  if (currentPlayer !== clockSeat || turnStartedAt == null) {
    return { state: { ...state, turnStartedAt: now, turnPausedAt: voting ? now : null }, clockSeat: currentPlayer };
  }
  if (voting && turnPausedAt == null) return { state: { ...state, turnPausedAt: now }, clockSeat };
  if (!voting && turnPausedAt != null) {
    return { state: { ...state, turnStartedAt: turnStartedAt + now - turnPausedAt, turnPausedAt: null }, clockSeat };
  }
  return { state, clockSeat };
}

// Milliseconds left, negative in overtime; null with the timer off or the turn not stamped
export function turnTimeLeft(
  state: Pick<BaseGameState, 'houseRules' | 'turnStartedAt' | 'turnPausedAt'>, now: number
): number | null {
  const limit = turnLimitMs(state);
  if (limit === 0 || state.turnStartedAt == null) return null;
  return limit - ((state.turnPausedAt ?? now) - state.turnStartedAt);
}
