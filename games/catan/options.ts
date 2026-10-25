// The house rules of catan, declared apart from the rules so the landing page can list them without loading the rules
import { targetScoreRule, type HouseRule, type ToggleRule } from '../../shared/houseRules.ts';

export const PLAYERS = { minPlayers: 3, maxPlayers: 6, stretchedPlayers: { min: 2, max: 6 } };

export const FIVE_SIX_FROM = 5;

export const POINTS_RULE = targetScoreRule(10, [8, 12], 'Points to win');
export const FRIENDLY_ROBBER_RULE: ToggleRule = {
  id: 'friendlyRobber', label: 'Friendly robber: players with 2 points or fewer cannot be robbed', kind: 'toggle', standard: false,
  help: 'The robber may still be moved to their hex, where it blocks production but steals nothing'
};
export const CATAN_RULES: HouseRule[] = [POINTS_RULE, FRIENDLY_ROBBER_RULE];

export const SPECIAL_BUILD: ToggleRule = {
  id: 'specialBuild',
  kind: 'toggle',
  standard: false,
  label: 'Special build phase',
  help: 'After each turn, every other player in turn order may build or buy a development card, without trading or playing cards',
  offered: seats => seats >= FIVE_SIX_FROM
};
