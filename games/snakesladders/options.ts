// The house rules of snakes and ladders, declared apart from the rules so the landing page can list them without loading the rules
import type { HouseRule, ToggleRule } from '../../shared/houseRules.ts';

export const EXACT_FINISH: ToggleRule = {
  id: 'exactFinish', label: 'Exact finish: a roll that would pass 100 does not move', kind: 'toggle', standard: false
};

export const SNAKES_LADDERS_RULES: HouseRule[] = [EXACT_FINISH];
