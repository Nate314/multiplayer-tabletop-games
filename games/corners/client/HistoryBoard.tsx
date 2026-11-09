import Board from './Board';
import Scores from './Scores';
import type { PublicGameState, Seat } from '../types.ts';

// The board right after one move, with that piece outlined, and the scores beside it. Nothing is clickable.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  return (
    <div className="corners-history">
      <div className="corners-history-board">
        <Board gameState={gameState} showLastMove />
      </div>
      <div className="corners-history-score">
        <Scores gameState={gameState} viewer={viewer} />
      </div>
    </div>
  );
}
