import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { FAQS } from './faq.ts';
import { CONTROLS } from './controls.ts';
import { describeMove } from './describeMove.ts';
import './sudoku.scss';

export const sudokuClient: ClientGame = {
  id: 'sudoku',
  Screen: GameScreen,
  faq: FAQS,
  controls: CONTROLS,
  HistoryBoard,
  describeMove
};
