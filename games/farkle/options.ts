// The house rules of farkle, declared apart from the rules so the landing page can list them without loading the rules
import { targetScoreRule, type HouseRule } from '../../shared/houseRules.ts';

export const TARGET_RULE = targetScoreRule(10000, [5000, 15000, 20000]);
export const FARKLE_RULES: HouseRule[] = [TARGET_RULE];
