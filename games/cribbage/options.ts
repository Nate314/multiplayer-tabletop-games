// The house rules of cribbage, declared apart from the rules so the landing page can list them without loading the rules
import { targetScoreRule, type ChoiceRule, type HouseRule, type ToggleRule } from '../../shared/houseRules.ts';

export const TARGET_RULE = targetScoreRule(121, [61], 'Game length');

export const MUGGINS_RULE: ToggleRule = { id: 'muggins', label: 'Muggins', kind: 'toggle', standard: false };

// 'name': the presser names the missed points; 'single': one press, a wrong one costs 2; 'shown': the total is shown
export const MUGGINS_STYLE_RULE: ChoiceRule<'name' | 'single' | 'shown'> = {
  id: 'mugginsStyle', label: 'Muggins style', kind: 'choice', standard: 'name',
  offered: (_, values) => values.muggins === true,
  choices: [
    { value: 'name', label: 'Name the points' },
    { value: 'single', label: 'Single press' },
    { value: 'shown', label: 'Shown total' }
  ]
};

export const CRIBBAGE_RULES: HouseRule[] = [TARGET_RULE, MUGGINS_RULE, MUGGINS_STYLE_RULE];
