// The house rules of inorder, declared apart from the rules so the landing page can list them without loading the rules
import { targetScoreRule, type HouseRule } from '../../shared/houseRules.ts';

export const TARGET_RULE = targetScoreRule(500, [250, 1000]);
export const IN_ORDER_RULES: HouseRule[] = [TARGET_RULE];
