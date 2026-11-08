import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { FAQS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import { initPhysics } from '../physics.ts';
import './blocktower.scss';

// The preview needs Rapier's WASM before the first render; awaited here, since a top-level await breaks Vite's default build target
export async function loadBlocktowerClient(): Promise<ClientGame> {
  await initPhysics();
  return { id: 'blocktower', Screen: GameScreen, faq: FAQS, HistoryBoard, describeMove };
}
