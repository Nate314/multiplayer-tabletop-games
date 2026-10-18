import Board from './Board';
import PlayerList from './PlayerList';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The board right after one move, with the tile that move placed (or put a meeple on) outlined, and the scores then.
// Only the order of the tiles to come is hidden, and no view has it, so every seat sees the same; nothing is clickable.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const highlight = gameState.lastMove ? gameState.board.length - 1 : null;
  return (
    <div className="cc-history">
      <div className="cc-board-area">
        <Board board={gameState.board} highlight={highlight} />
      </div>
      <PlayerList gameState={gameState} viewer={viewer} />
    </div>
  );
}
