// The house rules of dominoes, declared apart from the rules so the landing page can list them without loading the rules
import type { ChoiceRule, HouseRule, ToggleRule } from '../../shared/houseRules.ts';
import type { Branching } from './board.ts';
import type { SetSize } from './types.ts';

export const SET_RULE: ChoiceRule<SetSize> = {
  id: 'set', label: 'Set', kind: 'choice', standard: 6,
  choices: [{ value: 6, label: 'Double-six (28 tiles)' }, { value: 9, label: 'Double-nine (55 tiles)' }]
};
export const BRANCHING_RULE: ChoiceRule<Branching> = {
  id: 'branching', label: 'Doubles open branches', kind: 'choice', standard: 'every',
  choices: [
    { value: 'none', label: 'None (a single line)' },
    { value: 'starter', label: 'Starting double only' },
    { value: 'every', label: 'Every double' }
  ]
};
export const CHICKENFOOT_RULE: ToggleRule = {
  id: 'chickenfoot', label: 'Chickenfoot', kind: 'toggle', standard: false,
  help: 'After a double, every end it opens must get a tile before anyone plays elsewhere'
};
export const TRAINS_RULE: ToggleRule = {
  id: 'trains', label: 'Trains (Mexican Train)', kind: 'toggle', standard: false,
  help: 'Play only on your own train, the Mexican train or an open train'
};
export const TARGET_RULE: ChoiceRule = {
  id: 'targetScore', label: 'Target score', kind: 'choice', standard: 'standard',
  choices: [
    { value: 'standard', label: '100 for 2 players, 61 for 3 or 4' },
    { value: 61, label: '61' },
    { value: 100, label: '100' },
    { value: 150, label: '150' },
    { value: 200, label: '200' }
  ]
};
export const DOMINOES_RULES: HouseRule[] = [SET_RULE, BRANCHING_RULE, CHICKENFOOT_RULE, TRAINS_RULE, TARGET_RULE];
