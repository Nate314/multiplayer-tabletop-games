// The landing page's view of Sudoku: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { SUDOKU_RULES } from './options.ts';

export const sudokuInfo: GameInfo = {
  id: 'sudoku',
  category: 'puzzle',
  name: 'Sudoku',
  description: 'Fill the grid so every row, column and box holds 1 to 9, alone, together or as a race',
  minPlayers: 1,
  maxPlayers: 8,
  houseRules: SUDOKU_RULES,
  ownTurnLimit: true
};
