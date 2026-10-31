import TowerView from './TowerView';
import { startingTower } from '../physics.ts';
import type { PublicGameState } from '../types.ts';
import type { HistoryStep, Seat } from '../../../shared/types.ts';

// The tower after one move: the placed block highlighted on top and a ghost where it was pulled from. Everyone sees the same tower
export default function HistoryBoard({ gameState }: { gameState: PublicGameState & { historyStep?: HistoryStep['historyStep'] }; viewer: Seat | null }) {
  const { lastMove } = gameState;
  const placed = lastMove?.type === 'place' ? lastMove : null;
  // The platform's start state is taken just before the first Place, mid-turn, so the start step shows the untouched tower
  const blocks = gameState.historyStep === 'start' ? startingTower() : gameState.blocks;
  return (
    <div className="jenga-history">
      <TowerView blocks={blocks} highlight={placed?.block ?? null} ghost={placed?.from ?? null} />
    </div>
  );
}
