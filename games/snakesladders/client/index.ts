import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { FAQS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import animateMove from './animateMove.ts';
import './snakesladders.scss';

export const snakesladdersClient: ClientGame = {
  id: 'snakesladders',
  Screen: GameScreen,
  faq: FAQS,
  HistoryBoard,
  describeMove,
  animateMove
};
