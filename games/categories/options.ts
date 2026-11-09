// The house rules of categories, declared apart from the rules so the landing page can list them without loading the rules
import { type ChoiceRule, type HouseRule, type ToggleRule } from '../../shared/houseRules.ts';

export const HARD_LETTERS: ToggleRule = {
  id: 'hardLetters', label: 'Hard letters', kind: 'toggle', standard: false,
  help: 'Adds Q, U, V, X, Y and Z to the letters.'
};
export const ROUNDS: ChoiceRule<1 | 2 | 3 | 4 | 5> = {
  id: 'rounds', label: 'Rounds', kind: 'choice', standard: 3,
  choices: [
    { value: 1, label: '1 round' },
    { value: 2, label: '2 rounds' },
    { value: 3, label: '3 rounds' },
    { value: 4, label: '4 rounds' },
    { value: 5, label: '5 rounds' }
  ]
};
export const ROUND_SECONDS: ChoiceRule<60 | 90 | 120 | 180> = {
  id: 'roundSeconds', label: 'Time per round', kind: 'choice', standard: 120,
  choices: [
    { value: 60, label: '1 minute' },
    { value: 90, label: '90 seconds' },
    { value: 120, label: '2 minutes' },
    { value: 180, label: '3 minutes' }
  ]
};
export const LIST_SIZE: ChoiceRule<8 | 10 | 12> = {
  id: 'listSize', label: 'Categories per list', kind: 'choice', standard: 12,
  choices: [
    { value: 8, label: '8 categories' },
    { value: 10, label: '10 categories' },
    { value: 12, label: '12 categories' }
  ]
};
export const CATEGORIES_RULES: HouseRule[] = [ROUNDS, ROUND_SECONDS, LIST_SIZE, HARD_LETTERS];

export const EASY_LETTERS = [...'ABCDEFGHIJKLMNOPRSTW'];
export const HARD = [...'QUVXYZ'];

export function lettersFor(hard: boolean): string[] {
  return hard ? [...EASY_LETTERS, ...HARD] : [...EASY_LETTERS];
}
