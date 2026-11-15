import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import { FinalRound } from './RoundSummary';
import { plural } from '../../../shared/text.ts';
import HistoryBoard from './HistoryBoard';
import { QUESTIONS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import './cribbage.scss';

export const cribbageClient: ClientGame = {
  id: 'cribbage',
  Screen: GameScreen,
  faq: QUESTIONS,
  HistoryBoard,
  describeMove,
  FinalRound,
  gameLength: ({ handNumber }) => plural(handNumber, 'hand')
};
