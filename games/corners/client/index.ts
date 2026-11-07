import type { ClientGame } from '../../../src/clientGames.ts';
import { plural } from '../../../shared/text.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { FAQS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import type { PublicGameState } from '../types.ts';
import './corners.scss';

export const cornersClient: ClientGame = {
  id: 'corners',
  Screen: GameScreen,
  faq: FAQS,
  HistoryBoard,
  describeMove,
  gameLength: ({ placed }: PublicGameState) => plural(placed.length, 'piece')
};
