import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { QUESTIONS } from './faq.ts';
import { CONTROLS } from './controls.ts';
import { describeMove } from './describeMove.ts';
import './drawandguess.scss';

export const drawandguessClient: ClientGame = {
  id: 'drawandguess',
  Screen: GameScreen,
  faq: QUESTIONS,
  controls: CONTROLS,
  HistoryBoard,
  describeMove
};
