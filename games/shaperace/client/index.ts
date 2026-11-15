import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { describeMove } from './describeMove.ts';
import { QUESTIONS } from './faq.ts';
import './shaperace.scss';

export const shaperaceClient: ClientGame = {
  id: 'shaperace',
  Screen: GameScreen,
  faq: QUESTIONS,
  HistoryBoard,
  describeMove
};
