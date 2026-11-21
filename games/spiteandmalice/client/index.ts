import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import animateMove from './animateMove.ts';
import { QUESTIONS } from './faq.ts';
import { CONTROLS } from './controls.ts';
import { describeMove } from './describeMove.ts';
import './spiteandmalice.scss';

export const spiteandmaliceClient: ClientGame = {
  id: 'spiteandmalice',
  Screen: GameScreen,
  faq: QUESTIONS,
  controls: CONTROLS,
  HistoryBoard,
  describeMove,
  animateMove
};
