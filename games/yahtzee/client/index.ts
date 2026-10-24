import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { FAQS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import './yahtzee.scss';

export const yahtzeeClient: ClientGame = {
  id: 'yahtzee',
  Screen: GameScreen,
  faq: FAQS,
  icon: '🎲',
  HistoryBoard,
  describeMove
};
