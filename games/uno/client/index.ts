import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { QUESTIONS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import animateMove from './animateMove.ts';
import './uno.css';

export const unoClient: ClientGame = {
  id: 'uno',
  Screen: GameScreen,
  faq: QUESTIONS,
  icon: '🃏',
  HistoryBoard,
  describeMove,
  animateMove
};
