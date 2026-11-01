// The house rules of Sudoku, declared apart from the rules so the landing page can list them without loading the rules
import { type ChoiceRule, type HouseRule } from '../../shared/houseRules.ts';
import { MODE_RULE } from '../../shared/puzzleModes.ts';

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTY: ChoiceRule<Difficulty> = {
  id: 'difficulty', label: 'Difficulty', kind: 'choice', standard: 'medium',
  help: 'Easy needs only singles; Medium has fewer givens; Hard needs more than singles.',
  choices: [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' }
  ]
};

export const SUDOKU_RULES: HouseRule[] = [MODE_RULE, DIFFICULTY];
