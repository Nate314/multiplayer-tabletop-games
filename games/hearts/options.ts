// The house rules of hearts, declared apart from the rules so the landing page can list them without loading the rules
import { targetScoreRule, type HouseRule, type ToggleRule } from '../../shared/houseRules.ts';

export const TARGET_RULE = targetScoreRule(100, [50, 75, 150]);
export const JACK_RULE: ToggleRule = {
  id: 'jackOfDiamonds', label: 'Jack of Diamonds is worth minus 10', kind: 'toggle', standard: false,
  help: 'Whoever takes the jack of diamonds scores 10 less for the hand, even when they shoot the moon'
};
export const HEARTS_RULES: HouseRule[] = [TARGET_RULE, JACK_RULE];
