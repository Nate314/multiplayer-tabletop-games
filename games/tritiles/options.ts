// The house rules of Tri-Tiles, declared apart from the rules so the landing page can list them without loading the rules
import type { ChoiceRule, HouseRule, ToggleRule } from '../../shared/houseRules.ts';

export const HEXAGON_RULE: ToggleRule = {
  id: 'hexagon', label: 'Hexagon bonus', kind: 'toggle', standard: true,
  help: '50 points for each hexagon a tile completes'
};
export const BRIDGE_RULE: ToggleRule = {
  id: 'bridge', label: 'Bridge bonus', kind: 'toggle', standard: true,
  help: '40 points for completing a bridge'
};
export const TARGET_RULE: ChoiceRule<200 | 400 | 600> = {
  id: 'targetScore', label: 'Target score', kind: 'choice', standard: 400,
  choices: [{ value: 200, label: '200' }, { value: 400, label: '400' }, { value: 600, label: '600' }]
};
export const TRITILES_RULES: HouseRule[] = [HEXAGON_RULE, BRIDGE_RULE, TARGET_RULE];
