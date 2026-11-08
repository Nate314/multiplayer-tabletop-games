import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import animateMove from './animateMove.ts';
import { QUESTIONS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import './spiteandmalice.scss';

export const spiteandmaliceClient: ClientGame = {
  id: 'spiteandmalice',  Screen: GameScreen,
  faq: QUESTIONS,
  HistoryBoard,
  describeMove,
  animateMove
};
