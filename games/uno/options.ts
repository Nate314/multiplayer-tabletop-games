// The house rules of uno, declared apart from the rules so the landing page can list them without loading the rules
import { targetScoreRule, type HouseRule, type ToggleRule } from '../../shared/houseRules.ts';

export const TARGET_RULE = targetScoreRule(500, [250, 1000]);
export const STACKING_RULE: ToggleRule = {
  id: 'stacking', label: 'Stack +2 and +4 cards', kind: 'toggle', standard: false,
  help: 'A Draw Two or Wild Draw Four can be answered with another one instead of drawing'
};
export const SEVEN_ZERO_RULE: ToggleRule = {
  id: 'sevenZero', label: '7-0: a 7 swaps hands, a 0 passes every hand', kind: 'toggle', standard: false
};
export const DRAW_UNTIL_RULE: ToggleRule = {
  id: 'drawUntilPlayable', label: 'Draw until you can play', kind: 'toggle', standard: false
};
export const JUMP_IN_RULE: ToggleRule = {
  id: 'jumpIn', label: 'Jump-in', kind: 'toggle', standard: false,
  help: 'Any player can play a number card out of turn if it matches the top card exactly, and play continues from them'
};
export const UNO_RULES: HouseRule[] = [TARGET_RULE, STACKING_RULE, SEVEN_ZERO_RULE, DRAW_UNTIL_RULE, JUMP_IN_RULE];
