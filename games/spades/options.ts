// The house rules of spades, declared apart from the rules so the landing page can list them without loading the rules
import { targetScoreRule, type HouseRule } from '../../shared/houseRules.ts';

export const TARGET_RULE = targetScoreRule(500, [250, 300]);
export const SPADES_RULES: HouseRule[] = [TARGET_RULE];
