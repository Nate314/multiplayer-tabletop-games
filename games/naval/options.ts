// The house rules of Naval Battle, declared apart from the rules so the landing page can list them without loading the rules
import { type HouseRule, type ToggleRule } from '../../shared/houseRules.ts';

export const SALVO: ToggleRule = {
  id: 'salvo', label: 'Salvo', kind: 'toggle', standard: false,
  help: 'Each turn, fire one shot per ship you still have afloat'
};
export const ANNOUNCE_LENGTH: ToggleRule = {
  id: 'announceLength', label: 'Say the length on the first hit', kind: 'toggle', standard: false,
  help: 'The first hit on a ship tells everyone its length'
};
export const NAVAL_RULES: HouseRule[] = [SALVO, ANNOUNCE_LENGTH];
