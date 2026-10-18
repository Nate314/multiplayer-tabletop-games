import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { FAQS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import animateMove from './animateMove.ts';
import './parchisi.css';

export const parchisiClient: ClientGame = {
  id: 'parchisi',
  Screen: GameScreen,
  faq: FAQS,
  icon: '⚄',
  HistoryBoard,
  describeMove,
  animateMove
};
