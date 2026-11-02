// The house rules of Go, declared apart from the rules so the landing page can list them without loading the rules
import { type ChoiceRule, type HouseRule } from '../../shared/houseRules.ts';

export const BOARD_SIZE: ChoiceRule<9 | 13 | 19> = {
  id: 'boardSize', label: 'Board size', kind: 'choice', standard: 19,
  choices: [
    { value: 9, label: '9x9' },
    { value: 13, label: '13x13' },
    { value: 19, label: '19x19' }
  ]
};
export const GO_RULES: HouseRule[] = [BOARD_SIZE];
