import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { FAQS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import './backgammon.css';

export const backgammonClient: ClientGame = {
  id: 'backgammon',
  Screen: GameScreen,
  faq: FAQS,
  icon: '🎲',
  HistoryBoard,
  describeMove
};
