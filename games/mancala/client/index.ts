import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { FAQS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import animateMove from './animateMove.ts';
import './mancala.css';

export const mancalaClient: ClientGame = {
  id: 'mancala',
  Screen: GameScreen,
  faq: FAQS,
  icon: '🪨',
  HistoryBoard,
  describeMove,
  animateMove
};
