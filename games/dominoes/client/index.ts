import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { QUESTIONS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import animateMove from './animateMove.ts';
import './dominoes.css';

export const dominoesClient: ClientGame = {
  id: 'dominoes',
  Screen: GameScreen,
  faq: QUESTIONS,
  icon: '🁫',
  HistoryBoard,
  describeMove,
  animateMove
};
