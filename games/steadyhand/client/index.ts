import type { ClientGame } from '../../../src/clientGames.ts';
import { plural } from '../../../shared/text.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { describeMove } from './describeMove.ts';
import { QUESTIONS } from './faq.ts';
import type { PublicGameState } from '../types.ts';
import './steadyhand.scss';

export const steadyhandClient: ClientGame = {
  id: 'steadyhand',
  Screen: GameScreen,
  faq: QUESTIONS,
  HistoryBoard,
  describeMove,
  gameLength: ({ outBy }: PublicGameState) => plural(Object.keys(outBy).length, 'part')
};
