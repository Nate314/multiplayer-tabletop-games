import type { ClientGame } from '../../../src/clientGames.ts';
import { plural } from '../../../shared/text.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { FinalRound } from './RevealRows';
import { QUESTIONS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import './fictionary.scss';

export const fictionaryClient: ClientGame = {
  id: 'fictionary',
  Screen: GameScreen,
  faq: QUESTIONS,
  HistoryBoard,
  describeMove,
  FinalRound,
  gameLength: ({ round }) => plural(round, 'word')
};
