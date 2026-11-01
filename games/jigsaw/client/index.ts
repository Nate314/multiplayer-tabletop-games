import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import { QUESTIONS } from './faq.ts';
import './jigsaw.scss';

export const jigsawClient: ClientGame = {
  id: 'jigsaw',
  Screen: GameScreen,
  faq: QUESTIONS,
  // Task 6 fills these in: the history board and the move descriptions
  HistoryBoard: () => null,
  describeMove: () => ''
};
