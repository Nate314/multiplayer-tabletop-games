import type { ClientGame } from '../../../src/clientGames.ts';
import animateMove from './animateMove.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { FAQS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import './fivedice.scss';

export const fivediceClient: ClientGame = {
  id: 'fivedice',
  Screen: GameScreen,
  faq: FAQS,
  HistoryBoard,
  describeMove,
  animateMove
};
