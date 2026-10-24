import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { QUESTIONS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import './phase10.scss';

export const phase10Client: ClientGame = {
  id: 'phase10',
  Screen: GameScreen,
  faq: QUESTIONS,
  icon: '10',
  HistoryBoard,
  describeMove
};
