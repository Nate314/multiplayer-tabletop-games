// The house rules of Trading Floor, declared apart from the rules so the landing page can list them without loading the rules
import { targetScoreRule } from '../../shared/houseRules.ts';
import type { HouseRule, ToggleRule } from '../../shared/houseRules.ts';

export const TARGET_RULE = targetScoreRule(500, [250]);

export const BULL_BEAR_RULE: ToggleRule = {
  id: 'bullBear', label: 'Bull and Bear', kind: 'toggle', standard: false,
  help: 'Adds a wild Bull and a costly Bear to the deck.'
};

export const TRADINGFLOOR_RULES: HouseRule[] = [TARGET_RULE, BULL_BEAR_RULE];
