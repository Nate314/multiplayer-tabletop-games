import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { QUESTIONS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import './scrabble.css';

export const scrabbleClient: ClientGame = {
  id: 'scrabble',
  Screen: GameScreen,
  faq: QUESTIONS,
  icon: '▦',
  HistoryBoard,
  describeMove
};
