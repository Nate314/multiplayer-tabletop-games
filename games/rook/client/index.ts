import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import { FinalRound } from './RoundSummary';
import { plural } from '../../../shared/text.ts';
import HistoryBoard from './HistoryBoard';
import { QUESTIONS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import animateMove from './animateMove.ts';
import './rook.scss';

export const rookClient: ClientGame = {
  id: 'rook',
  Screen: GameScreen,
  faq: QUESTIONS,
  HistoryBoard,
  describeMove,
  animateMove,
  FinalRound,
  gameLength: ({ handNumber }) => plural(handNumber, 'hand')
};
