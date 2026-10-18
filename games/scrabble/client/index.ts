import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { QUESTIONS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import { animateMove, identityOrder } from './animateMove.ts';
import './scrabble.css';

export const scrabbleClient: ClientGame = {
  id: 'scrabble',
  Screen: GameScreen,
  faq: QUESTIONS,
  icon: '▦',
  HistoryBoard,
  describeMove,
  // The history shows a rack in its own order; with no seat chosen, seat 0 is nobody
  animateMove: (change, viewer) => animateMove(change, viewer ?? 0, identityOrder(change.previous.rack))
};
