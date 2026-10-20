import Table from './Table';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The table right after one move. Viewed as a player, their rack and the card they hold are shown too, read only.
// Nothing is clickable.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  return (
    <div className="racko-history">
      <Table gameState={gameState} viewer={viewer} />
    </div>
  );
}
