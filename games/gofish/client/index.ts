import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { QUESTIONS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import animateMove from './animateMove.ts';
import './gofish.scss';

export const gofishClient: ClientGame = {
  id: 'gofish',
  Screen: GameScreen,
  faq: QUESTIONS,
  HistoryBoard,
  describeMove,
  animateMove
};
