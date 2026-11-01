import Board from './Board';
import ScorePanel from './ScorePanel';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The board right after one move, with that move ringed, and the captures and count beside it. Nothing is clickable.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  return (
    <div className="go-history">
      <div className="go-history-board">
        <Board gameState={gameState} />
      </div>
      <div className="go-history-score">
        <ScorePanel gameState={gameState} viewer={viewer} />
      </div>
    </div>
  );
}
