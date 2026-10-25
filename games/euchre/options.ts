// The house rules of euchre, declared apart from the rules so the landing page can list them without loading the rules
import { targetScoreRule, type HouseRule } from '../../shared/houseRules.ts';

export const TARGET_RULE = targetScoreRule(10, [5, 15]);
export const EUCHRE_RULES: HouseRule[] = [TARGET_RULE];
