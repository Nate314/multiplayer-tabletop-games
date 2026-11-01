// The house rules of code breaker, declared apart from the rules so the landing page can list them without loading the rules
import type { ChoiceRule, HouseRule } from '../../shared/houseRules.ts';
import { modeRule, type PuzzleMode } from '../../shared/puzzleModes.ts';

export type Mode = PuzzleMode | 'classic';

export const CODEBREAKER_MODE: ChoiceRule<Mode> = modeRule<'classic'>(
  [{ value: 'classic', label: 'Classic', offered: seats => seats === 2 }],
  seats => seats === 1 ? 'solo' : seats === 2 ? 'classic' : 'together'
);

export const CODE_RULE: ChoiceRule<'4of6' | '5of8'> = {
  id: 'code', label: 'Code', kind: 'choice', standard: '4of6',
  help: 'Repeated colors are allowed. 10 guesses per code.',
  choices: [
    { value: '4of6', label: '4 pegs, 6 colors' },
    { value: '5of8', label: '5 pegs, 8 colors' }
  ]
};

export const CODEBREAKER_RULES: HouseRule[] = [CODEBREAKER_MODE, CODE_RULE];

export const COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'cyan'] as const;
export type Color = (typeof COLORS)[number];

export const MAX_GUESSES = 10;
export const ROUNDS_EACH = 2; // Classic: each player makes the code this many times

export function codeShape(value: '4of6' | '5of8'): { pegs: 4 | 5; colors: Color[] } {
  return value === '4of6' ? { pegs: 4, colors: COLORS.slice(0, 6) } : { pegs: 5, colors: [...COLORS] };
}
