// The house rules of phase10, declared apart from the rules so the landing page can list them without loading the rules
import { type ToggleRule } from '../../shared/houseRules.ts';

export const ANY_ORDER_RULE: ToggleRule = {
  id: 'anyOrder', label: 'Phases in any order', kind: 'toggle', standard: false,
  help: 'Each hand a player lays down any phase they have not completed; completing all ten finishes'
};
export const PHASE10_RULES = [ANY_ORDER_RULE];
