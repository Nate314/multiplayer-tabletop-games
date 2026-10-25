import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { QUESTIONS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import animateMove from './animateMove.ts';
import './holdem.scss';

export const holdemClient: ClientGame = {
  id: 'holdem',
  Screen: GameScreen,
  faq: QUESTIONS,
  HistoryBoard,
  describeMove,
  animateMove
};
