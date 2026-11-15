import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { QUESTIONS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import './bingo.scss';

export const bingoClient: ClientGame = {
  id: 'bingo',
  Screen: GameScreen,
  faq: QUESTIONS,
  HistoryBoard,
  describeMove
};
