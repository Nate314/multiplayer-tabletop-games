import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { QUESTIONS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import { animateMove } from './animateMove.ts';
import './rummytiles.scss';

export const rummytilesClient: ClientGame = {
  id: 'rummytiles',
  Screen: GameScreen,
  faq: QUESTIONS,
  HistoryBoard,
  describeMove,
  animateMove: (change) => animateMove(change)
};
