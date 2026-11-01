import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { FAQS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import './naval.scss';

// No animateMove: shots snap into place
export const navalClient: ClientGame = {
  id: 'naval',
  Screen: GameScreen,
  faq: FAQS,
  HistoryBoard,
  describeMove
};
