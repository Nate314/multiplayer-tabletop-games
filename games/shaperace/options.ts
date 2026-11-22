// The house rules of Shape Race, declared apart from the rules so the landing page can list them without loading the rules
import type { ChoiceRule, HouseRule } from '../../shared/houseRules.ts';
import type { BoardSize } from './board.ts';

export const SIZE_RULE: ChoiceRule<BoardSize> = {
  id: 'shapes', label: 'Board size', kind: 'choice', standard: 16,
  choices: [
    { value: 9, label: '9 shapes' },
    { value: 16, label: '16 shapes' },
    { value: 25, label: '25 shapes' }
  ]
};

export const TIMER_RULE: ChoiceRule<30 | 60 | 90> = {
  id: 'seconds', label: 'Timer', kind: 'choice', standard: 60,
  choices: [
    { value: 30, label: '30 seconds' },
    { value: 60, label: '60 seconds' },
    { value: 90, label: '90 seconds' }
  ]
};

export const END_RULE: ChoiceRule<'keep' | 'first'> = {
  id: 'raceEnd', label: 'Race end', kind: 'choice', standard: 'keep',
  help: 'Keep racing ranks everyone by finish time; First finish ends the race when the first board is full.',
  offered: seats => seats >= 2,
  choices: [
    { value: 'keep', label: 'Keep racing' },
    { value: 'first', label: 'First finish' }
  ]
};

export const SHAPERACE_RULES: HouseRule[] = [SIZE_RULE, TIMER_RULE, END_RULE];
