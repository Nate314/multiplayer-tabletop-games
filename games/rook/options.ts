// The house rules of rook, declared apart from the rules so the landing page can list them without loading the rules
import { targetScoreRule, type ChoiceRule, type HouseRule } from '../../shared/houseRules.ts';

export const TARGET_RULE = targetScoreRule(500, [300, 1000]);

export type SixTeams = 'twoOfThree' | 'threeOfTwo';
export const SIX_TEAMS: ChoiceRule<SixTeams> = {
  id: 'sixTeams', label: 'Teams at 6 players', kind: 'choice', standard: 'twoOfThree',
  choices: [{ value: 'twoOfThree', label: 'Two teams of three' }, { value: 'threeOfTwo', label: 'Three teams of two' }],
  offered: seats => seats === 6
};

// How the teams that did not win the bid score: each the counters it took, or each what all of them took together
export const DEFENDERS: ChoiceRule<'separate' | 'together'> = {
  id: 'defenders', label: 'Defending teams score', kind: 'choice', standard: 'separate',
  choices: [{ value: 'separate', label: 'Each team its own counters' }, { value: 'together', label: 'Together, both teams\' counters' }],
  offered: (seats, values) => seats === 6 && values.sixTeams === 'threeOfTwo'
};

export const ROOK_RULES: HouseRule[] = [TARGET_RULE, SIX_TEAMS, DEFENDERS];
