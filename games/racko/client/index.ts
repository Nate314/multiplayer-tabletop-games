import type { ClientGame } from '../../../src/clientGames.ts';
import animateMove from './animateMove.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { QUESTIONS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import './racko.scss';

export const rackoClient: ClientGame = {
  id: 'racko',
  Screen: GameScreen,
  faq: QUESTIONS,
  HistoryBoard,
  describeMove,
  animateMove
};
