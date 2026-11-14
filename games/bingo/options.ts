// The house rules of bingo, declared apart from the rules so the landing page can list them without loading the rules
import type { ChoiceRule, HouseRule } from '../../shared/houseRules.ts';
import type { Pattern } from './types.ts';

export const CARDS_RULE: ChoiceRule<number> = {
  id: 'cards', label: 'Cards per player', kind: 'choice', standard: 1,
  choices: Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))
};

export const PATTERN_RULE: ChoiceRule<Pattern> = {
  id: 'pattern', label: 'Pattern', kind: 'choice', standard: 'line',
  choices: [
    { value: 'line', label: 'Line' },
    { value: 'corners', label: 'Four corners' },
    { value: 'blackout', label: 'Blackout' }
  ]
};

export const PLAY_UNTIL_RULE: ChoiceRule<number> = {
  id: 'playUntil', label: 'Play until', kind: 'choice', standard: 1,
  choices: [{ value: 1, label: '1st place' }, { value: 2, label: '2nd place' }, { value: 3, label: '3rd place' }]
};

export const BINGO_RULES: HouseRule[] = [CARDS_RULE, PATTERN_RULE, PLAY_UNTIL_RULE];
