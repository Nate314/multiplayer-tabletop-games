// The house rules of fictionary, declared apart from the rules so the landing page can list them without loading the rules
import { type ChoiceRule, type HouseRule } from '../../shared/houseRules.ts';

export const WORD_COUNT: ChoiceRule<5 | 8 | 10> = {
  id: 'wordCount', label: 'Number of words', kind: 'choice', standard: 8,
  choices: [
    { value: 5, label: '5 words' },
    { value: 8, label: '8 words' },
    { value: 10, label: '10 words' }
  ]
};
export const WRITING_SECONDS: ChoiceRule<60 | 90 | 120 | 180> = {
  id: 'writingSeconds', label: 'Writing time', kind: 'choice', standard: 120,
  choices: [
    { value: 60, label: '1 minute' },
    { value: 90, label: '90 seconds' },
    { value: 120, label: '2 minutes' },
    { value: 180, label: '3 minutes' }
  ]
};
export const FICTIONARY_RULES: HouseRule[] = [WORD_COUNT, WRITING_SECONDS];
