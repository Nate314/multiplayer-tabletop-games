import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { FAQS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import animateMove from './animateMove.ts';
import './checkers.css';

export const checkersClient: ClientGame = {
  id: 'checkers',
  Screen: GameScreen,
  faq: FAQS,
  icon: '⛀',
  HistoryBoard,
  describeMove,
  animateMove
};
