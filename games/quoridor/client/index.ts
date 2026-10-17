import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import { FAQS } from './faq.ts';
import './quoridor.css';

export const quoridorClient: ClientGame = {
  id: 'quoridor',
  Screen: GameScreen,
  faq: FAQS,
  icon: '♟'
};
