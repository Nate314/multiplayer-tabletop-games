// The house rules of jigsaw, declared apart from the rules so the landing page can list them without loading the rules
import type { ChoiceRule, HouseRule } from '../../shared/houseRules.ts';
import { MODE_RULE } from '../../shared/puzzleModes.ts';
import type { PieceCount } from './cut.ts';

export const PIECES_RULE: ChoiceRule<PieceCount> = {
  id: 'pieces', label: 'Pieces', kind: 'choice', standard: 48,
  choices: [
    { value: 24, label: '24 pieces' },
    { value: 48, label: '48 pieces' },
    { value: 96, label: '96 pieces' },
    { value: 150, label: '150 pieces' }
  ]
};

export const JIGSAW_RULES: HouseRule[] = [MODE_RULE, PIECES_RULE];
