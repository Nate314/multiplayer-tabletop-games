// The round clock, shared by the browser and the server; imports no rules code
import { houseRule } from '../../shared/houseRules.ts';
import { ROUND_SECONDS } from './options.ts';
import type { GameState } from './types.ts';

type Clocked = Pick<GameState, 'phase' | 'houseRules' | 'phaseStartedAt'>;

// When answering ends, in server ms; no clock runs in the lobby, in review or after the game
export function phaseDeadline(state: Clocked): number | null {
  if (state.phase !== 'answering' || state.phaseStartedAt === null) return null;
  return state.phaseStartedAt + houseRule(state, ROUND_SECONDS) * 1000;
}
