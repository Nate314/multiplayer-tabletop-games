// The house rules of pictionary, declared apart from the rules so the landing page can list them without loading the rules
import { type ChoiceRule, type HouseRule } from '../../shared/houseRules.ts';

export const TURN_SECONDS: ChoiceRule<30 | 60 | 90 | 120 | 180> = {
  id: 'turnSeconds', label: 'Time per turn', kind: 'choice', standard: 90,
  choices: [
    { value: 30, label: '30 seconds' },
    { value: 60, label: '1 minute' },
    { value: 90, label: '90 seconds' },
    { value: 120, label: '2 minutes' },
    { value: 180, label: '3 minutes' }
  ]
};
export const WORD_CHOICES: ChoiceRule<3 | 4 | 5> = {
  id: 'wordChoices', label: 'Word choices', kind: 'choice', standard: 3,
  choices: [
    { value: 3, label: '3 words' },
    { value: 4, label: '4 words' },
    { value: 5, label: '5 words' }
  ]
};
export const DRAWS_PER_PLAYER: ChoiceRule<1 | 2 | 3 | 4 | 5> = {
  id: 'drawsPerPlayer', label: 'Draws per player', kind: 'choice', standard: 3,
  choices: [
    { value: 1, label: '1 draw' },
    { value: 2, label: '2 draws' },
    { value: 3, label: '3 draws' },
    { value: 4, label: '4 draws' },
    { value: 5, label: '5 draws' }
  ]
};
export const PICTIONARY_RULES: HouseRule[] = [TURN_SECONDS, WORD_CHOICES, DRAWS_PER_PLAYER];
