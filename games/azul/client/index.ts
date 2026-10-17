import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import { QUESTIONS } from './faq.ts';
import './azul.css';

export const azulClient: ClientGame = {
  id: 'azul',
  Screen: GameScreen,
  faq: QUESTIONS,
  icon: '◆'
};
