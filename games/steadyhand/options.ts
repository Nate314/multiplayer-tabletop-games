// The house rules of Steady Hand, declared apart from the rules so the landing page can list them without loading the rules
import type { ChoiceRule, HouseRule } from '../../shared/houseRules.ts';

// No standardFor: a solo room's 3 would be kept anyway when friends join
export const BUZZES_RULE: ChoiceRule<0 | 1 | 3 | 5> = {
  id: 'buzzes', label: 'Buzzes allowed', kind: 'choice', standard: 3,
  help: 'A player who has used all their buzzes is out of turns.',
  choices: [{ value: 0, label: 'Unlimited' }, { value: 1, label: '1' }, { value: 3, label: '3' }, { value: 5, label: '5' }]
};

export const TOLERANCE_RULE: ChoiceRule<'easy' | 'normal' | 'hard'> = {
  id: 'tolerance', label: 'Wall tolerance', kind: 'choice', standard: 'normal',
  choices: [{ value: 'easy', label: 'Easy' }, { value: 'normal', label: 'Normal' }, { value: 'hard', label: 'Hard' }]
};

// The factor on each slot's half-width
export const TOLERANCE = { easy: 1.3, normal: 1, hard: 0.75 };

export const STEADYHAND_RULES: HouseRule[] = [BUZZES_RULE, TOLERANCE_RULE];

// Points per buzz left after clearing the board alone
export const SOLO_BONUS = 10;
