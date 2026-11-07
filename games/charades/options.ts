// The house rules of charades, declared apart from the rules so the landing page can list them without loading the rules
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
export const PROMPT_CHOICES: ChoiceRule<3 | 4 | 5> = {
  id: 'promptChoices', label: 'Prompt choices', kind: 'choice', standard: 3,
  choices: [
    { value: 3, label: '3 prompts' },
    { value: 4, label: '4 prompts' },
    { value: 5, label: '5 prompts' }
  ]
};
export const TURNS_PER_PLAYER: ChoiceRule<1 | 2 | 3 | 4 | 5> = {
  id: 'turnsPerPlayer', label: 'Turns per player', kind: 'choice', standard: 3,
  choices: [
    { value: 1, label: '1 turn' },
    { value: 2, label: '2 turns' },
    { value: 3, label: '3 turns' },
    { value: 4, label: '4 turns' },
    { value: 5, label: '5 turns' }
  ]
};
export const CHARADES_RULES: HouseRule[] = [TURN_SECONDS, PROMPT_CHOICES, TURNS_PER_PLAYER];
