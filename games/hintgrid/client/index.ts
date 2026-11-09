import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { QUESTIONS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import './hintgrid.scss';

export const hintgridClient: ClientGame = {
  id: 'hintgrid',
  Screen: GameScreen,
  faq: QUESTIONS,
  HistoryBoard,
  describeMove
};
