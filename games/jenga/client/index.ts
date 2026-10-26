import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { FAQS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import { initPhysics } from '../physics.ts';
import './jenga.scss';

// The preview needs Rapier's WASM before the first render; awaited here, since a top-level await breaks Vite's default build target
export async function loadJengaClient(): Promise<ClientGame> {
  await initPhysics();
  return { id: 'jenga', Screen: GameScreen, faq: FAQS, HistoryBoard, describeMove };
}
