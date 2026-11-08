import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { QUESTIONS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import './charades.scss';

export const charadesClient: ClientGame = {
  id: 'charades',
  Screen: GameScreen,
  faq: QUESTIONS,
  HistoryBoard,
  describeMove
};
