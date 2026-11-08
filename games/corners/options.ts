// The house rules of Corners, declared apart from the rules so the landing page can list them without loading the rules
import { type ChoiceRule, type HouseRule } from '../../shared/houseRules.ts';
import type { BoardKind } from './geometry.ts';

export const BOARD_RULE: ChoiceRule<BoardKind> = {
  id: 'board', label: 'Board', kind: 'choice', standard: 'squares',
  help: 'Squares: a 20 by 20 grid. Triangles: a six-sided board of triangles.',
  choices: [
    { value: 'squares', label: 'Squares' },
    { value: 'triangles', label: 'Triangles' }
  ]
};
export const CORNERS_RULES: HouseRule[] = [BOARD_RULE];
