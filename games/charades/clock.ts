// The turn's deadline for the browser, bound to this game's time per turn; imports no rules code
import { phaseDeadline as guessDeadline } from '../../shared/guessing/clock.ts';
import { TURN_SECONDS } from './options.ts';
import type { GameState } from './types.ts';

export const phaseDeadline = (state: Pick<GameState, 'phase' | 'houseRules' | 'phaseStartedAt' | 'started' | 'isGameOver'>) =>
  guessDeadline(state, TURN_SECONDS);
