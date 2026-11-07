import type { ClientGame } from '../../../src/clientGames.ts';
import { plural } from '../../../shared/text.ts';
import GameScreen from './GameScreen';
import HistoryBoard, { FinalRound } from './HistoryBoard';
import { describeMove } from './describeMove.ts';
import { QUESTIONS } from './faq.ts';
import './tradingfloor.scss';

export const tradingfloorClient: ClientGame = {
  id: 'tradingfloor',
  Screen: GameScreen,
  faq: QUESTIONS,
  HistoryBoard,
  describeMove,
  FinalRound,
  gameLength: ({ round }) => plural(round, 'round')
};
