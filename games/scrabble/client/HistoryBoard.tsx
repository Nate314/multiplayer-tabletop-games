import Board from './Board';
import Scores from './Scores';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The board right after one move, with the tiles of the last play highlighted, and the scores then.
// Seat 0 is nobody and the board takes no clicks.
export default function HistoryBoard({ gameState }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { board, lastMove } = gameState;
  return (
    <div className="history-layout">
      <Board board={board} highlighted={lastMove?.type === 'play' ? lastMove.tiles : []} />
      <Scores gameState={gameState} playerNumber={0} />
    </div>
  );
}
