import BigBoard from './BigBoard';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The boards right after one move, with that mark and any winning three boards highlighted. Both seats see the same boards, so the viewer changes nothing. Nothing is clickable.
export default function HistoryBoard({ gameState }: { gameState: PublicGameState; viewer: Seat | null }) {
  return (
    <div className="board">
      <BigBoard gameState={gameState} playable={false} onPlace={() => {}} />
    </div>
  );
}
