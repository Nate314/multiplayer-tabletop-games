import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { FAQS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import animateMove from './animateMove.ts';
import './pawnsandwalls.scss';

export const pawnsandwallsClient: ClientGame = {
  id: 'pawnsandwalls',
  Screen: GameScreen,
  faq: FAQS,
  HistoryBoard,
  describeMove,
  animateMove
};
