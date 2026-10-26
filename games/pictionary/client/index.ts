import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { QUESTIONS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import './pictionary.scss';

export const pictionaryClient: ClientGame = {
  id: 'pictionary',
  Screen: GameScreen,
  faq: QUESTIONS,
  HistoryBoard,
  describeMove
};
