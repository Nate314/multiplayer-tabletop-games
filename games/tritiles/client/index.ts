import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import { FinalRound } from './RoundSummary';
import { plural } from '../../../shared/text.ts';
import HistoryBoard from './HistoryBoard';
import { QUESTIONS } from './faq.ts';
import { CONTROLS } from './controls.ts';
import { describeMove } from './describeMove.ts';
import './tritiles.scss';

export const tritilesClient: ClientGame = {
  id: 'tritiles',
  Screen: GameScreen,
  faq: QUESTIONS,
  controls: CONTROLS,
  HistoryBoard,
  describeMove,
  FinalRound,
  gameLength: ({ roundNumber }) => plural(roundNumber, 'round')
};
