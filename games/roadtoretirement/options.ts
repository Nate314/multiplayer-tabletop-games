// The house rules of Road to Retirement, read from the table state by the rules and the board
import { houseRule, type ChoiceRule, type HouseRule, type HouseRuleValues } from '../../shared/houseRules.ts';
import type { BaseGameState } from '../../shared/types.ts';

const onRoad = (_seats: number, values: HouseRuleValues): boolean => values.board !== 'checkered';

export const BOARD_RULE: ChoiceRule<'road' | 'checkered'> = {
  id: 'board', label: 'Board', kind: 'choice', standard: 'road',
  choices: [{ value: 'road', label: 'Road to Retirement' }, { value: 'checkered', label: '1860 Checkered' }]
};
export const LENGTH_RULE: ChoiceRule<'short' | 'full'> = {
  id: 'length', label: 'Game length', kind: 'choice', standard: 'full', offered: onRoad,
  choices: [{ value: 'short', label: 'Short' }, { value: 'full', label: 'Full' }]
};
export const STARTING_CASH_RULE: ChoiceRule<number> = {
  id: 'startingCash', label: 'Starting cash', kind: 'choice', standard: 25000, offered: onRoad,
  choices: [10000, 25000, 50000].map(value => ({ value, label: `$${value.toLocaleString('en-US')}` }))
};

export const ROAD_RULES: HouseRule[] = [BOARD_RULE, LENGTH_RULE, STARTING_CASH_RULE];

type Holder = Pick<BaseGameState, 'houseRules'>;
export const boardOf = (state: Holder): 'road' | 'checkered' => houseRule(state, BOARD_RULE);
export const lengthOf = (state: Holder): 'short' | 'full' => houseRule(state, LENGTH_RULE);
export const startingCashOf = (state: Holder): number => houseRule(state, STARTING_CASH_RULE);
