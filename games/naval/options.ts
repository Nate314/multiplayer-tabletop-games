// The house rules of Naval Battle, declared apart from the rules so the landing page can list them without loading the rules
import { type HouseRule, type ToggleRule } from '../../shared/houseRules.ts';

export const SALVO: ToggleRule = {
  id: 'salvo', label: 'Salvo', kind: 'toggle', standard: false,
  help: 'Each turn, fire one shot per ship you still have afloat'
};
export const NAVAL_RULES: HouseRule[] = [SALVO];
