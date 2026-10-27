import TowerView from './TowerView';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The tower after one move: the placed block highlighted on top and a ghost where it was pulled from. Everyone sees the same tower
export default function HistoryBoard({ gameState }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { lastMove } = gameState;
  const placed = lastMove?.type === 'place' ? lastMove : null;
  return (
    <div className="jenga-history">
      <TowerView blocks={gameState.blocks} highlight={placed?.block ?? null} ghost={placed?.from ?? null} />
    </div>
  );
}
