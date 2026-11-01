import TowerView from './TowerView';
import { viewTurntable } from './camera.ts';
import { IDENTITY, startingTower } from '../physics.ts';
import type { PublicGameState } from '../types.ts';
import type { HistoryStep, Seat } from '../../../shared/types.ts';

// Built once: the start step of every History shows the same untouched tower
const START = startingTower();

// The tower after one move: the placed block highlighted on top and a ghost where it was pulled from. Everyone sees the same tower
export default function HistoryBoard({ gameState }: { gameState: PublicGameState & { historyStep?: HistoryStep['historyStep'] }; viewer: Seat | null }) {
  const { lastMove } = gameState;
  const placed = lastMove?.type === 'place' ? lastMove : null;
  // The platform's start state is taken just before the first Place, mid-turn, so the start step shows the untouched tower at rest
  const start = gameState.historyStep === 'start';
  const blocks = start ? START : gameState.blocks;
  const turntable = start ? IDENTITY : viewTurntable(gameState.turntable).q;
  return (
    <div className="jenga-history">
      <TowerView blocks={blocks} turntable={turntable} highlight={placed?.block ?? null} ghost={placed?.from ?? null} />
    </div>
  );
}
