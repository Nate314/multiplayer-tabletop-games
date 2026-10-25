import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import animateMove from './animateMove.ts';
import { QUESTIONS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import './skipbo.scss';

export const skipboClient: ClientGame = {
  id: 'skipbo',
  Screen: GameScreen,
  faq: QUESTIONS,
  HistoryBoard,
  describeMove,
  animateMove
};
