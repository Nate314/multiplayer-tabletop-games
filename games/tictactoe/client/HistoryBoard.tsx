import Grid from './Grid';
import { CELL_PREFIX } from './animateMove.ts';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The grid right after one move, with that mark and any winning three highlighted. Both seats see the same grid, so the viewer changes nothing. Nothing is clickable.
export default function HistoryBoard({ gameState }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { board, xSeat, lastMove, winningLine } = gameState;
  return (
    <div className="board">
      <Grid cells={board} xSeat={xSeat} playable={() => false} onPlace={() => {}} lastCell={lastMove?.cell ?? null}
        winningLine={winningLine} keyPrefix={CELL_PREFIX} label="Tic-Tac-Toe grid" />
    </div>
  );
}
