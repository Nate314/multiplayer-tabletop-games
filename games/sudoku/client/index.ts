import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { FAQS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import './sudoku.scss';

export const sudokuClient: ClientGame = {
  id: 'sudoku',
  Screen: GameScreen,
  faq: FAQS,
  HistoryBoard,
  describeMove
};
