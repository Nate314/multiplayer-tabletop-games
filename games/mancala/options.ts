// The house rules of mancala, declared apart from the rules so the landing page can list them without loading the rules
import { type HouseRule, type ToggleRule } from '../../shared/houseRules.ts';

export const OTHER_SIDE_RULE: ToggleRule = {
  id: 'otherSide', label: 'When your side is empty, play from the other side', kind: 'toggle', standard: true,
  help: 'You sow from any non-empty pit on the other side, and the game ends only when every pit is empty'
};
export const AVALANCHE_RULE: ToggleRule = {
  id: 'avalanche', label: 'Avalanche (off plays Kalah, with captures)', kind: 'toggle', standard: true,
  help: 'Off: no relays, and a last stone in an empty pit of yours captures the pit opposite'
};
export const MANCALA_RULES: HouseRule[] = [OTHER_SIDE_RULE, AVALANCHE_RULE];
