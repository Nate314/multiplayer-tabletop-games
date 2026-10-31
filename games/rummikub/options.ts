// The house rules of rummikub, declared apart from the rules so the landing page can list them without loading the rules
import type { HouseRule, ToggleRule } from '../../shared/houseRules.ts';

export const FREE_JOKERS_RULE: ToggleRule = {
  id: 'freeJokers', label: 'Jokers move freely', kind: 'toggle', standard: false,
  help: 'Jokers on the table move like any other tile; no tile has to replace them.'
};
export const ADD_ON_FIRST_MELD_RULE: ToggleRule = {
  id: 'addOnFirstMeld', label: 'Add to melds on your first turn', kind: 'toggle', standard: false,
  help: 'After laying 30 points in new groups, you may also add rack tiles to the groups on the table.'
};
export const RUMMIKUB_RULES: HouseRule[] = [FREE_JOKERS_RULE, ADD_ON_FIRST_MELD_RULE];
