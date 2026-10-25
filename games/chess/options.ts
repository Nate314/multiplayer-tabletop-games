// The house rules of chess, declared apart from the rules so the landing page can list them without loading the rules
import { type ChoiceRule, type HouseRule } from '../../shared/houseRules.ts';

export const CLOCK_MINUTES: ChoiceRule<'off' | 5 | 10 | 15> = {
  id: 'clockMinutes', label: 'Clock', kind: 'choice', standard: 'off',
  choices: [
    { value: 'off', label: 'Off' },
    { value: 5, label: '5 minutes' },
    { value: 10, label: '10 minutes' },
    { value: 15, label: '15 minutes' }
  ]
};
export const INCREMENT_SECONDS: ChoiceRule<0 | 2 | 5 | 10> = {
  id: 'incrementSeconds', label: 'Increment per move', kind: 'choice', standard: 0,
  choices: [
    { value: 0, label: 'None' },
    { value: 2, label: '2 seconds' },
    { value: 5, label: '5 seconds' },
    { value: 10, label: '10 seconds' }
  ],
  offered: (_, values) => values.clockMinutes !== 'off'
};
export const CHESS_RULES: HouseRule[] = [CLOCK_MINUTES, INCREMENT_SECONDS];
