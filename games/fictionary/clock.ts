// Phase timings for the browser and the server; imports no rules code
import { houseRule } from '../../shared/houseRules.ts';
import { WRITING_SECONDS } from './options.ts';
import type { GameState } from './types.ts';

export const VOTING_MS = 60_000;

export function phaseMs(state: Pick<GameState, 'phase' | 'houseRules'>): number {
  return state.phase === 'writing' ? houseRule(state, WRITING_SECONDS) * 1000 : VOTING_MS;
}

// When the current phase ends, in server ms; no clock runs before the house rules are agreed, at the reveal or after the game
export function phaseDeadline(state: Pick<GameState, 'phase' | 'houseRules' | 'phaseStartedAt' | 'isGameOver'>): number | null {
  if (state.isGameOver || state.phaseStartedAt === null || state.phase === 'reveal') return null;
  return state.phaseStartedAt + phaseMs(state);
}
