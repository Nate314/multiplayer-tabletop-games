// The house rules of jenga, declared apart from the rules so the landing page can list them without loading the rules
import { type HouseRule, type ToggleRule } from '../../shared/houseRules.ts';

export const FREE_PLACEMENT_RULE: ToggleRule = {
  id: 'freePlacement', label: 'Free placement', kind: 'toggle', standard: false,
  help: 'Set the block on top yourself, where you let go; the physics decides what happens'
};
export const JENGA_RULES: HouseRule[] = [FREE_PLACEMENT_RULE];
