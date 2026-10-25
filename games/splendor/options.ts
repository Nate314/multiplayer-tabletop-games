// The house rules of splendor, declared apart from the rules so the landing page can list them without loading the rules
import { targetScoreRule, type HouseRule } from '../../shared/houseRules.ts';

export const PRESTIGE_RULE = targetScoreRule(15, [10, 21], 'Prestige to win');
export const SPLENDOR_RULES: HouseRule[] = [PRESTIGE_RULE];
