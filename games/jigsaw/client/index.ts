import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { describeMove } from './describeMove.ts';
import { QUESTIONS } from './faq.ts';
import './jigsaw.scss';

export const jigsawClient: ClientGame = {
  id: 'jigsaw',
  Screen: GameScreen,
  faq: QUESTIONS,
  HistoryBoard,
  describeMove
};
