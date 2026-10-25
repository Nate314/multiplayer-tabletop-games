// The house rules of scrabble, declared apart from the rules so the landing page can list them without loading the rules
import { type ChoiceRule, type HouseRule } from '../../shared/houseRules.ts';

export const TURN_MINUTES: ChoiceRule<'off' | 1 | 2 | 3 | 5> = {
  id: 'turnMinutes', label: 'Turn timer', kind: 'choice', standard: 'off',
  choices: [
    { value: 'off', label: 'Off' },
    { value: 1, label: '1 minute' },
    { value: 2, label: '2 minutes' },
    { value: 3, label: '3 minutes' },
    { value: 5, label: '5 minutes' }
  ]
};
export const SCRABBLE_RULES: HouseRule[] = [TURN_MINUTES];
