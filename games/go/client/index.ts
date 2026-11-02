import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { FAQS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import animateMove from './animateMove.ts';
import './go.scss';

export const goClient: ClientGame = {
  id: 'go',
  Screen: GameScreen,
  faq: FAQS,
  HistoryBoard,
  describeMove,
  animateMove
};
