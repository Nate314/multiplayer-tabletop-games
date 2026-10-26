import type { ClientGame } from '../../../src/clientGames.ts';
import animateMove from './animateMove.ts';
import GameScreen from './GameScreen';
import { FinalRound } from './HandSummary';
import { plural } from '../../../shared/text.ts';
import HistoryBoard from './HistoryBoard';
import { QUESTIONS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import './phase10.scss';

export const phase10Client: ClientGame = {
  id: 'phase10',
  Screen: GameScreen,
  faq: QUESTIONS,
  HistoryBoard,
  describeMove,
  animateMove,
  FinalRound,
  gameLength: ({ handNumber }) => plural(handNumber, 'hand')
};
