// Phase timings of a guessing game, shared by the browser and the server; imports no rules code
import { houseRule, type ChoiceRule } from '../houseRules.ts';
import type { GuessState } from './types.ts';

export const CHOOSE_MS = 20_000;
export const REVEAL_MS = 5_000;

type Clocked = Pick<GuessState, 'phase' | 'houseRules' | 'phaseStartedAt' | 'started' | 'isGameOver'>;

export function phaseMs(state: Pick<GuessState, 'phase' | 'houseRules'>, turnSeconds: ChoiceRule<number>): number {
  if (state.phase === 'choosing') return CHOOSE_MS;
  if (state.phase === 'reveal') return REVEAL_MS;
  return houseRule(state, turnSeconds) * 1000;
}

// When the current phase ends, in server ms; no clock runs in the lobby or after the game
export function phaseDeadline(state: Clocked, turnSeconds: ChoiceRule<number>): number | null {
  if (!state.started || state.isGameOver || state.phaseStartedAt === null) return null;
  return state.phaseStartedAt + phaseMs(state, turnSeconds);
}
