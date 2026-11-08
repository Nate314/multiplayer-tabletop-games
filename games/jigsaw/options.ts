// The house rules of jigsaw, declared apart from the rules so the landing page can list them without loading the rules
import type { ChoiceRule, HouseRule, ToggleRule } from '../../shared/houseRules.ts';
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

export const ROTATION_RULE: ToggleRule = {
  id: 'rotation', label: 'Rotate pieces', kind: 'toggle', standard: false,
  help: 'Pieces start turned. Turn one with its ↻ handle, or with R or a right-click while you hold it. A piece snaps only the right way up'
};

export const JIGSAW_RULES: HouseRule[] = [MODE_RULE, PIECES_RULE, ROTATION_RULE];
