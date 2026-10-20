import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { QUESTIONS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import './racko.css';

export const rackoClient: ClientGame = {
  id: 'racko',
  Screen: GameScreen,
  faq: QUESTIONS,
  icon: '📶',
  HistoryBoard,
  describeMove
};
