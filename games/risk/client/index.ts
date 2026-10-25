import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { FAQS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import animateMove from './animateMove.ts';
import './risk.scss';

export const riskClient: ClientGame = {
  id: 'risk',
  Screen: GameScreen,
  faq: FAQS,
  HistoryBoard,
  describeMove,
  animateMove
};
